import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormField } from "./form-field";
import { Input } from "./ui/input";
import { CopyButton } from "./copy-button";
const mocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
	cleanup(); vi.clearAllMocks();
	if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
	else Reflect.deleteProperty(navigator, "clipboard");
});

describe("accessible form composition", () => {
	it("connects the label to the actual control and forwards its ref", () => {
		const ref = createRef<HTMLInputElement>();
		render(<FormField label="Account name"><Input ref={ref} /></FormField>);
		expect(screen.getByLabelText("Account name")).toBe(ref.current);
	});
	it("keeps explicit ids and associates field errors without dropping descriptions", () => {
		render(<FormField label="Email" error="Invalid email"><Input id="email-test" aria-describedby="help" /></FormField>);
		const field = screen.getByLabelText("Email");
		expect(field.id).toBe("email-test");
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(field.getAttribute("aria-describedby")).toBe("help email-test-error");
		expect(screen.getByRole("alert").textContent).toBe("Invalid email");
	});
	it("supports native select fields", () => {
		render(<FormField label="HTTP method"><select defaultValue="GET"><option>GET</option><option>POST</option></select></FormField>);
		expect(screen.getByLabelText("HTTP method").tagName).toBe("SELECT");
	});
});

describe("clipboard feedback", () => {
	it("copies the exact value before announcing success", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		render(<CopyButton text="fixture-value" />);
		fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
		await waitFor(() => expect(screen.getByRole("status").textContent).toBe("已复制"));
		expect(writeText).toHaveBeenCalledWith("fixture-value");
		expect(mocks.error).not.toHaveBeenCalled();
	});
	it("reports denied clipboard permission instead of claiming it copied", async () => {
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
		render(<CopyButton text="fixture-value" />);
		fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
		await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Could not copy to clipboard"));
		expect(screen.getByRole("status").textContent).toBe("复制失败");
	});
});
