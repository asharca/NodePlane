import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn(), importNodes: vi.fn() }));
vi.mock("../lib/client", () => ({ client: { subscription: { Create: api.create, Delete: api.remove }, checker: { ImportNodes: api.importNodes } } }));
import { createNodeGroup } from "./subscriptions";

beforeEach(() => {
	vi.resetAllMocks();
	api.create.mockResolvedValue({ id: "new-fixture-group", kind: "node", name: "Fixture" });
	api.remove.mockResolvedValue(undefined);
	api.importNodes.mockResolvedValue({ count: 1 });
});

describe("create node group transaction", () => {
	it("creates a subscription without attempting node import", async () => {
		await createNodeGroup({ params: { name: "Fixture", cron_expr: "", export_include_dead: false, export_sort: "speed_desc", kind: "subscription", url: "https://example.invalid/sub" } });
		expect(api.importNodes).not.toHaveBeenCalled();
		expect(api.remove).not.toHaveBeenCalled();
	});
	it("rejects an empty single-node input before creating a group", async () => {
		await expect(createNodeGroup({ params: { name: "Fixture", url: "", cron_expr: "", export_include_dead: false, export_sort: "speed_desc", kind: "node" }, nodeContent: " " })).rejects.toThrow("Paste one node share link");
		expect(api.create).not.toHaveBeenCalled();
	});
	it("imports the node into the group created by the same operation", async () => {
		const result = await createNodeGroup({ params: { name: "Fixture", url: "", cron_expr: "", export_include_dead: false, export_sort: "speed_desc", kind: "node" }, nodeContent: " fixture-link " });
		expect(result.id).toBe("new-fixture-group");
		expect(api.importNodes).toHaveBeenCalledWith("new-fixture-group", { content: "fixture-link", append: true });
		expect(api.remove).not.toHaveBeenCalled();
	});
	it("removes the new group and preserves the original import error", async () => {
		const error = new Error("invalid node");
		api.importNodes.mockRejectedValue(error);
		await expect(createNodeGroup({ params: { name: "Fixture", url: "", cron_expr: "", export_include_dead: false, export_sort: "speed_desc", kind: "node" }, nodeContent: "invalid" })).rejects.toBe(error);
		expect(api.remove).toHaveBeenCalledExactlyOnceWith("new-fixture-group");
	});
	it("reports a failed cleanup with the affected group instead of claiming rollback", async () => {
		api.importNodes.mockRejectedValue(new Error("invalid node"));
		api.remove.mockRejectedValue(new Error("offline"));
		await expect(createNodeGroup({ params: { name: "Fixture", url: "", cron_expr: "", export_include_dead: false, export_sort: "speed_desc", kind: "node" }, nodeContent: "invalid" })).rejects.toThrow("Remove node group new-fixture-group before retrying");
	});
	it("never deletes anything when initial creation fails", async () => {
		api.create.mockRejectedValue(new Error("offline"));
		await expect(createNodeGroup({ params: { name: "Fixture", url: "", cron_expr: "", export_include_dead: false, export_sort: "speed_desc", kind: "node" }, nodeContent: "node" })).rejects.toThrow("offline");
		expect(api.remove).not.toHaveBeenCalled();
		expect(api.importNodes).not.toHaveBeenCalled();
	});
});
