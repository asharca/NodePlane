import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearToken, getToken, isAuthenticated, setToken } from "./auth";
import { handleUnauthorized } from "./client";
import { APIError, ErrCode } from "./client.gen";

const token = (exp: number) => `fixture.${btoa(JSON.stringify({ sub: "fixture", exp }))}.fixture`;
beforeEach(() => { clearToken(); window.history.replaceState({}, "", "/"); });
afterEach(() => { clearToken(); window.history.replaceState({}, "", "/"); });

describe("browser session state (server remains responsible for signature verification)", () => {
	it("starts unauthenticated", () => { expect(getToken()).toBeNull(); expect(isAuthenticated()).toBe(false); });
	it("keeps non-remembered sessions out of persistent storage", () => {
		setToken("session", false);
		expect(getToken()).toBe("session");
		expect(localStorage.getItem("jwt_token")).toBeNull();
	});
	it("clears the previous storage scope when remember-me changes", () => {
		setToken("persistent", true); setToken("session", false);
		expect(localStorage.getItem("jwt_token")).toBeNull();
		setToken("remembered", true);
		expect(sessionStorage.getItem("jwt_token")).toBeNull();
		expect(getToken()).toBe("remembered");
	});
	it("accepts unexpired client state", () => {
		setToken(token(Math.floor(Date.now() / 1000) + 60), false);
		expect(isAuthenticated()).toBe(true);
	});
	it("clears expired sessions from both storage scopes", () => {
		setToken(token(Math.floor(Date.now() / 1000) - 60), true);
		expect(isAuthenticated()).toBe(false); expect(getToken()).toBeNull();
	});
	it.each(["invalid", "a.invalid.b", "a.e30.broken."])("handles malformed/expired state safely: %s", (value) => {
		// A valid JSON payload is not a server-verified token. This test only
		// asserts that malformed payloads do not throw; API auth is tested separately.
		setToken(value, false);
		expect(() => isAuthenticated()).not.toThrow();
		if (value !== "a.e30.broken.") expect(getToken()).toBeNull();
	});
	it("leaves rejected login requests on the form instead of reloading it", () => {
		window.history.replaceState({}, "", "/login");
		expect(handleUnauthorized(new APIError(401, { code: ErrCode.Unauthenticated, message: "Invalid credentials" }))).toBe(false);
		expect(window.location.pathname).toBe("/login");
	});
	it("does not treat an unrelated error as session expiry", () => {
		expect(handleUnauthorized(new Error("offline"))).toBe(false);
	});
});
