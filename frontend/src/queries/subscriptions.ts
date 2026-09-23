import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/client";
import type { subscription } from "../lib/client.gen";
import { queryKeys } from "./queryKeys";

export function useSubscriptions() {
	return useQuery({
		queryKey: queryKeys.subscriptions(),
		queryFn: () => client.subscription.List(),
	});
}

export function useCreateSubscription() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (p: subscription.CreateParams) => client.subscription.Create(p),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.subscriptions() });
		},
	});
}

export async function createNodeGroup(args: {
	params: subscription.CreateParams;
	nodeContent?: string;
}) {
	const content = args.nodeContent?.trim();
	if (args.params.kind === "node" && !content) {
		throw new Error("Paste one node share link");
	}
	const group = await client.subscription.Create(args.params);
	if (content) {
		try {
			await client.checker.ImportNodes(group.id, { content, append: true });
		} catch (importError) {
			// Compensate only for the group created by this operation, never for an
			// existing group. Do not report success if cleanup also fails.
			try { await client.subscription.Delete(group.id); }
			catch (cleanupError) {
				throw new AggregateError([importError, cleanupError], `Import and cleanup failed. Remove node group ${group.id} before retrying.`);
			}
			throw importError;
		}
	}
	return group;
}

export function useCreateNodeGroup() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: createNodeGroup,
		onSuccess: (_group, args) => {
			if (args.params.kind === "node") {
				qc.invalidateQueries({ queryKey: queryKeys.nodes(_group.id) });
			}
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: queryKeys.subscriptions() });
		},
	});
}

export function useUpdateSubscription() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (args: { id: string; params: subscription.UpdateParams }) =>
			client.subscription.Update(args.id, args.params),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.subscriptions() });
		},
	});
}

export function useDeleteSubscription() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => client.subscription.Delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.subscriptions() });
		},
	});
}

// useSetFetchProxy chooses the node used to tunnel a subscription's fetch
// (empty config = direct).
export function useSetFetchProxy() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (args: { id: string; config: string }) =>
			client.subscription.SetFetchProxy(args.id, { config: args.config }),
		onSuccess: (_data, args) => {
			qc.invalidateQueries({ queryKey: queryKeys.subscriptions() });
			qc.invalidateQueries({ queryKey: queryKeys.nodes(args.id) });
		},
	});
}
