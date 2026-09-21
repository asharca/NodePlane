import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { subscription } from "@/lib/client.gen";
import { AddNodeDialog } from "./add-node-dialog";
import { NodeGroupDialog } from "./subscription-dialog";

const mutate = vi.fn();
const createGroupMutate = vi.fn();
const updateGroupMutate = vi.fn();

vi.mock("@/queries", () => ({
	useImportNodes: () => ({ isPending: false, mutate }),
	useCreateNodeGroup: () => ({ isPending: false, mutate: createGroupMutate }),
	useUpdateSubscription: () => ({
		isPending: false,
		mutate: updateGroupMutate,
	}),
}));

function renderDialog() {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<AddNodeDialog
				open
				onOpenChange={vi.fn()}
				fixedSubscription={{
					id: "sub-1",
					name: "Test",
					url: "https://example.com",
				}}
			/>
		</QueryClientProvider>,
	);
}

function renderStandaloneDialog() {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<AddNodeDialog
				open
				onOpenChange={vi.fn()}
				subscriptions={
					[
						{ id: "sub-1", name: "Test", url: "https://example.com" },
					] as subscription.Subscription[]
				}
			/>
		</QueryClientProvider>,
	);
}

describe("AddNodeDialog", () => {
	beforeEach(() => {
		mutate.mockClear();
		createGroupMutate.mockClear();
		updateGroupMutate.mockClear();
	});
	afterEach(cleanup);

	it("enables Add node after entering a share link", () => {
		renderDialog();
		const add = screen.getByRole("button", {
			name: "Add node",
		}) as HTMLButtonElement;
		expect(add.disabled).toBe(true);

		fireEvent.input(screen.getByPlaceholderText("vmess://..."), {
			target: { value: "vmess://eyJ2IjoiMiJ9" },
		});

		expect(add.disabled).toBe(false);
	});

	it("enables Add node from the standalone entry", () => {
		renderStandaloneDialog();
		const add = screen.getByRole("button", {
			name: "Add node",
		}) as HTMLButtonElement;

		fireEvent.input(screen.getByPlaceholderText("vmess://..."), {
			target: { value: "vmess://eyJ2IjoiMiJ9" },
		});

		expect(add.disabled).toBe(false);
	});

	it("appends the entered link instead of replacing nodes", () => {
		renderDialog();
		fireEvent.input(screen.getByPlaceholderText("vmess://..."), {
			target: { value: "vmess://eyJ2IjoiMiJ9" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add node" }));

		expect(mutate).toHaveBeenCalledWith(
			{ content: "vmess://eyJ2IjoiMiJ9", append: true },
			expect.anything(),
		);
	});
});

describe("NodeGroupDialog", () => {
	afterEach(cleanup);

	it("creates a single-node group from a share link", () => {
		render(
			<QueryClientProvider client={new QueryClient()}>
				<NodeGroupDialog open onOpenChange={vi.fn()} />
			</QueryClientProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Single node/ }));
		const add = screen.getByRole("button", {
			name: "Add group",
		}) as HTMLButtonElement;
		expect(add.disabled).toBe(true);

		fireEvent.input(screen.getByPlaceholderText("vmess://..."), {
			target: { value: "vmess://eyJ2IjoiMiJ9" },
		});

		expect(add.disabled).toBe(false);
		fireEvent.click(add);

		expect(createGroupMutate).toHaveBeenCalledWith(
			expect.objectContaining({
				params: expect.objectContaining({ kind: "node", url: "" }),
				nodeContent: "vmess://eyJ2IjoiMiJ9",
			}),
			expect.anything(),
		);
	});
});
