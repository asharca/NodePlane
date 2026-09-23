import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "./sonner";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("sonner", () => ({
	Toaster: ({ position, closeButton, theme }: { position?: string; closeButton?: boolean; theme?: string }) => (
		<div data-testid="notification-layer" data-position={position} data-dismissible={String(closeButton)} data-theme={theme} />
	),
}));
afterEach(cleanup);

describe("notification layer configuration", () => {
	it("defaults to dismissible top-center notifications rather than covering footer Save", () => {
		render(<Toaster />);
		const layer = screen.getByTestId("notification-layer");
		expect(layer.dataset.position).toBe("top-center");
		expect(layer.dataset.dismissible).toBe("true");
		expect(layer.dataset.theme).toBe("dark");
	});
	it("retains explicit caller overrides", () => {
		render(<Toaster position="bottom-left" closeButton={false} />);
		const layer = screen.getByTestId("notification-layer");
		expect(layer.dataset.position).toBe("bottom-left");
		expect(layer.dataset.dismissible).toBe("false");
	});
});
