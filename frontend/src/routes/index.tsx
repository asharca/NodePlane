import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { RequestError } from "@/components/request-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailPane } from "@/components/workbench/detail-pane";
import { WorkbenchOverview } from "@/components/workbench/overview";
import { SubList } from "@/components/workbench/sub-list";
import { NodeGroupDialog } from "@/components/workbench/subscription-dialog";
import { isApiError } from "@/lib/client";
import { groupDisplayName } from "@/lib/group-view";
import { cn } from "@/lib/utils";
import {
	useDeleteSubscription,
	useLatestJobs,
	useSSEProgress,
	useSubscriptions,
	useUpdateSubscription,
} from "@/queries";
const searchSchema = z.object({ sub: z.string().optional() });
export const Route = createFileRoute("/")({
	validateSearch: searchSchema,
	component: WorkbenchPage,
});
function WorkbenchPage() {
	const navigate = useNavigate({ from: "/" });
	const { sub: selectedFromUrl } = Route.useSearch();
	const [addOpen, setAddOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [activeJobId, setActiveJobId] = useState<string | null>(null);
	const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
	const subsQuery = useSubscriptions();
	const latestQuery = useLatestJobs();
	const subs = subsQuery.data?.subscriptions ?? [];
	const latestJobs = latestQuery.data?.jobs ?? {};
	const selected = subs.find((sub) => sub.id === selectedFromUrl);
	const selectedId = selected?.id ?? null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when changing groups
	useEffect(() => {
		setActiveJobId(null);
		setSelectedJobId(null);
	}, [selectedId]);
	const latestForSelected = selectedId ? latestJobs[selectedId] : undefined;
	useEffect(() => {
		if (
			latestForSelected &&
			(latestForSelected.status === "running" ||
				latestForSelected.status === "queued")
		)
			setActiveJobId((current) => current ?? latestForSelected.id);
	}, [latestForSelected]);
	const { progress, logEntries, debugData, connection, inflight } =
		useSSEProgress({
			jobId: activeJobId,
			subscriptionId: selectedId ?? "",
			onDone: () => {
				setActiveJobId(null);
				setSelectedJobId(null);
			},
		});
	const liveProgressPct =
		activeJobId && progress?.total
			? ((progress.progress ?? 0) / progress.total) * 100
			: null;
	const updateMut = useUpdateSubscription();
	const deleteMut = useDeleteSubscription();
	const select = (id: string | null) =>
		navigate({ search: id ? { sub: id } : {}, replace: false });
	function handleToggleEnabled() {
		if (!selected) return;
		updateMut.mutate(
			{
				id: selected.id,
				params: {
					name: selected.name,
					url: selected.url,
					enabled: !selected.enabled,
					cron_expr: selected.cron_expr ?? "",
					clear_cron_expr: false,
					export_include_dead: selected.export_include_dead ?? false,
					export_sort: selected.export_sort ?? "speed_desc",
				},
			},
			{
				onSuccess: () =>
					toast.success(
						selected.enabled ? "Node group disabled" : "Node group enabled",
					),
				onError: (error) =>
					toast.error(isApiError(error) ? error.message : "Failed to update"),
			},
		);
	}
	function handleDelete() {
		if (!selected) return;
		deleteMut.mutate(selected.id, {
			onSuccess: () => {
				toast.success("Node group deleted");
				setDeleteOpen(false);
				void select(null);
			},
			onError: (error) =>
				toast.error(isApiError(error) ? error.message : "Delete failed"),
		});
	}
	if (subsQuery.isError && !subsQuery.data)
		return (
			<RequestError
				title="Unable to load node groups"
				onRetry={() => void subsQuery.refetch()}
				retrying={subsQuery.isFetching}
			/>
		);
	return (
		<div className="flex h-full min-h-0">
			<div
				className={cn(
					"h-full w-full min-w-0 border-border/70 md:w-[280px] md:shrink-0 md:border-r xl:w-[310px]",
					selectedId ? "hidden md:block" : "block",
				)}
			>
				<SubList
					subs={subs}
					latestJobs={latestJobs}
					loading={subsQuery.isLoading}
					selectedId={selectedId}
					liveProgressPct={liveProgressPct}
					onSelect={(id) => void select(id)}
					onAdd={() => setAddOpen(true)}
				/>
			</div>
			<div
				className={cn(
					"h-full min-w-0 flex-1",
					selectedId ? "block" : "hidden md:block",
				)}
			>
				{selected ? (
					<DetailPane
						key={selected.id}
						sub={selected}
						activeJobId={activeJobId}
						progress={progress}
						logEntries={logEntries}
						debugData={debugData}
						connection={connection}
						inflight={inflight}
						selectedJobId={selectedJobId}
						onSelectJob={setSelectedJobId}
						onRunStarted={setActiveJobId}
						onEdit={() => setEditOpen(true)}
						onToggleEnabled={handleToggleEnabled}
						onDelete={() => setDeleteOpen(true)}
						onBack={() => void select(null)}
					/>
				) : (
					<WorkbenchOverview
						subs={subs}
						latestJobs={latestJobs}
						loading={subsQuery.isLoading || latestQuery.isLoading}
						summaryError={latestQuery.isError}
						onRetry={() => void latestQuery.refetch()}
						onAdd={() => setAddOpen(true)}
						onSelect={(id) => void select(id)}
					/>
				)}
			</div>
			<NodeGroupDialog open={addOpen} onOpenChange={setAddOpen} />
			<NodeGroupDialog
				open={editOpen}
				onOpenChange={setEditOpen}
				sub={selected ?? null}
			/>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete "${selected ? groupDisplayName(selected) : ""}"?`}
				description="This removes the node group, all of its nodes and the entire check history. This cannot be undone."
				confirmLabel="Delete"
				pending={deleteMut.isPending}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
