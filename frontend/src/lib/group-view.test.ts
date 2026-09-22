import { afterEach, describe, expect, it, vi } from "vitest";
import { filterGroups, groupDisplayName, groupSourceLabel, relativeTime, summarizeGroups } from "./group-view";
import { getWorkspacePage } from "./navigation";
const groups = [
	{ id: "one", name: "Europe", kind: "subscription", url: "https://user:password@example.com:8443/private/secret?token=private-key#hidden", enabled: true },
	{ id: "two", name: "Asia", kind: "node", url: "ss://private-credentials", enabled: false },
];
afterEach(() => vi.useRealTimers());
describe("group presentation", () => {
	it("never displays subscription credentials, private paths, tokens or fragments", () => { expect(groupSourceLabel(groups[0])).toBe("example.com:8443"); });
	it("does not reveal direct share links", () => { expect(groupSourceLabel(groups[1])).toBe("Direct share link"); });
	it("does not echo malformed URLs or unsupported protocols", () => { expect(groupSourceLabel({ kind: "subscription", url: "secret-invalid-input" })).toBe("Remote subscription"); expect(groupSourceLabel({ kind: "subscription", url: "javascript:alert(1)" })).toBe("Remote subscription"); });
	it("uses a safe fallback name", () => { expect(groupDisplayName({ ...groups[0], name: "" })).toBe("example.com:8443"); expect(groupDisplayName({ ...groups[1], name: "  " })).toBe("Single node"); });
	it("searches without case sensitivity and ignores whitespace", () => { expect(filterGroups(groups, " EUROPE ", "all")).toEqual([groups[0]]); });
	it("combines enabled and paused filters with search", () => { expect(filterGroups(groups, "", "enabled")).toEqual([groups[0]]); expect(filterGroups(groups, "", "paused")).toEqual([groups[1]]); expect(filterGroups(groups, "Europe", "paused")).toEqual([]); });
	it("does not search private URL tokens", () => { expect(filterGroups(groups, "private-key", "all")).toEqual([]); });
	it("summarizes only existing groups and completed snapshots", () => {
		expect(summarizeGroups(groups, { one: { status: "completed", available: 7, total: 9 }, two: { status: "running", available: 2, total: 5 }, deleted: { status: "completed", available: 99, total: 100 } })).toEqual({ total: 2, enabled: 1, running: 1, failed: 0, completed: 1, available: 7, checked: 9 });
	});
	it("does not treat failed or untested groups as completed healthy data", () => { const summary = summarizeGroups(groups, { one: { status: "failed", available: 3, total: 5 } }); expect(summary.completed).toBe(0); expect(summary.available).toBe(0); expect(summary.failed).toBe(1); });
	it("handles invalid and future timestamps", () => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-23T12:00:00Z")); expect(relativeTime("invalid")).toBe("Unknown time"); expect(relativeTime("2026-09-24T12:00:00Z")).toBe("just now"); expect(relativeTime("2026-09-23T10:00:00Z")).toBe("2h ago"); });
	it("keeps settings subroutes active without matching unrelated prefixes", () => { expect(getWorkspacePage("/settings/account").id).toBe("settings"); expect(getWorkspacePage("/rules").id).toBe("rules"); expect(getWorkspacePage("/settings-other").id).toBe("groups"); });
});
