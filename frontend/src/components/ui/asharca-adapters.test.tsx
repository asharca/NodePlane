import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Progress } from "./progress";
import { Switch } from "./switch";
afterEach(cleanup);
describe("Asharca compatibility adapters", () => {
	it("keeps submit buttons functional", () => {
		const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
		render(
			<form onSubmit={submit}>
				<Button type="submit">Save</Button>
			</form>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(submit).toHaveBeenCalledTimes(1);
	});
	it("blocks duplicate actions while loading", () => {
		const click = vi.fn();
		render(
			<Button loading onClick={click}>
				Save
			</Button>,
		);
		const button = screen.getByRole("button", { name: "Save" });
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.hasAttribute("disabled")).toBe(true);
		fireEvent.click(button);
		expect(click).not.toHaveBeenCalled();
	});
	it("forwards refs and respects the existing render prop", () => {
		const ref = createRef<HTMLButtonElement>();
		render(
			<Button ref={ref} render={<button data-custom="true" type="button" />}>
				Custom
			</Button>,
		);
		expect(ref.current).toBe(screen.getByRole("button", { name: "Custom" }));
		expect(ref.current?.dataset.custom).toBe("true");
	});
	it("does not inject a wrapper into externally labelled inputs", () => {
		const { container } = render(
			<Input id="legacy" aria-label="Legacy field" />,
		);
		expect(container.firstElementChild?.tagName).toBe("INPUT");
	});
	it("associates a field's label, description and error", () => {
		render(
			<Input
				label="Account name"
				description="Visible to you"
				error="This name is required"
			/>,
		);
		const input = screen.getByRole("textbox", { name: "Account name" });
		expect(input.getAttribute("aria-invalid")).toBe("true");
		const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
		expect(ids).toHaveLength(2);
		expect(ids.every((id) => document.getElementById(id))).toBe(true);
		expect(screen.getByRole("alert").textContent).toBe("This name is required");
	});
	it("clamps progress and labels the progressbar", () => {
		const { rerender } = render(
			<Progress label="Checking nodes" value={160} />,
		);
		expect(
			screen
				.getByRole("progressbar", { name: "Checking nodes" })
				.getAttribute("aria-valuenow"),
		).toBe("100");
		rerender(<Progress label="Checking nodes" value={Number.NaN} />);
		expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(
			false,
		);
	});
	it("keeps switch change semantics", () => {
		const change = vi.fn();
		render(<Switch aria-label="Enable schedule" onCheckedChange={change} />);
		fireEvent.click(screen.getByRole("switch", { name: "Enable schedule" }));
		expect(change.mock.calls[0][0]).toBe(true);
	});
	it("opens and closes existing compound dialogs using an adapted trigger", async () => {
		render(
			<Dialog>
				<DialogTrigger render={<Button />}>Open settings</DialogTrigger>
				<DialogContent>
					<DialogTitle>Example settings</DialogTitle>
					<DialogDescription>
						A test of the existing dialog contract.
					</DialogDescription>
				</DialogContent>
			</Dialog>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
		await screen.findByRole("dialog", { name: "Example settings" });
		fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
});
