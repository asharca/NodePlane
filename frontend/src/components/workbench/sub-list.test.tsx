import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { subscription } from "@/lib/client.gen";
import { SubList } from "./sub-list";
afterEach(cleanup);
const groups = [
	{ id: "one", name: "Europe", kind: "subscription", url: "https://example.com/sub?token=secret", enabled: true },
	{ id: "two", name: "Asia", kind: "node", url: "ss://secret", enabled: false },
] as subscription.Subscription[];
function list(props = {}) { return <SubList subs={groups} latestJobs={{}} loading={false} selectedId={null} liveProgressPct={null} onAdd={vi.fn()} onSelect={vi.fn()} {...props} />; }
describe("node group navigation", () => {
	it("searches groups and resets empty results", () => { render(list()); fireEvent.change(screen.getByRole("searchbox", { name: "Search node groups" }), { target: { value: "missing" } }); expect(screen.getByText("No matching groups")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Reset filters" })); expect(screen.getByText("Europe")).toBeTruthy(); expect(screen.getByText("Asia")).toBeTruthy(); });
	it("filters paused groups and selects by stable id", () => { const select = vi.fn(); render(list({ onSelect: select })); fireEvent.click(screen.getByRole("button", { name: "Paused", exact: true })); expect(screen.queryByText("Europe")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: /Asia/ })); expect(select).toHaveBeenCalledWith("two"); });
	it("does not leak subscription tokens in visible text", () => { const { container } = render(list()); expect(container.textContent).not.toContain("secret"); });
	it("keeps loading distinct from an empty account", () => { render(list({ subs: [], loading: true })); expect(screen.queryByText("Your first node group")).toBeNull(); expect(screen.getByText("Loading groups…")).toBeTruthy(); });
});
