import { ArrowLeft, Cable, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AddNodeDialog } from "@/components/workbench/add-node-dialog";
import { ExportPopover } from "@/components/workbench/export-popover";
import { NodeSourceMenu } from "@/components/workbench/node-source-menu";
import { RunCheckButton } from "@/components/workbench/run-check-button";
import type { checker, subscription } from "@/lib/client.gen";

type Subscription = subscription.Subscription;
type JobSummary = checker.JobSummary;

function jobLabel(j: JobSummary): string {
	const when = new Date(j.created_at).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
	if (j.status === "running" || j.status === "queued") {
		return `${when} · running`;
	}
	if (j.status === "failed") return `${when} · failed`;
	return `${when} · ${j.available}/${j.total}`;
}

export function DetailHeader({
	sub,
	jobs,
	selectedJobId,
	activeJobId,
	onSelectJob,
	onRunStarted,
	onEdit,
	onToggleEnabled,
	onDelete,
	onBack,
}: {
	sub: Subscription;
	jobs: JobSummary[];
	selectedJobId: string | null; // null = latest completed
	activeJobId: string | null; // currently running job (SSE attached)
	onSelectJob: (jobId: string | null) => void;
	onRunStarted: (jobId: string) => void;
	onEdit: () => void;
	onToggleEnabled: () => void;
	onDelete: () => void;
	onBack: () => void;
}) {
	const [addNodeOpen, setAddNodeOpen] = useState(false);

	return (
		<div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-border border-b px-4 py-3 md:px-5">
			<button
				type="button"
				onClick={onBack}
				aria-label="Back to list"
				className="rounded-md p-1 text-muted-foreground hover:bg-secondary md:hidden"
			>
				<ArrowLeft size={16} />
			</button>

			<div className="min-w-0 flex-1 basis-48">
				<div className="flex min-w-0 items-center gap-2">
					<h1 className="truncate font-semibold text-[15px] text-foreground">
						{sub.name || (sub.kind === "node" ? "Single node" : sub.url)}
					</h1>
					<Badge tone={sub.kind === "node" ? "info" : "neutral"}>
						{sub.kind === "node" ? "Single node" : "Subscription"}
					</Badge>
				</div>
				<div className="flex items-center gap-1">
					<p className="truncate font-mono text-[11px] text-muted-foreground">
						{sub.kind === "node" ? "Direct share link" : sub.url}
					</p>
					{sub.url ? <CopyButton text={sub.url} /> : null}
				</div>
			</div>

			<div className="flex items-center gap-2">
				{jobs.length > 0 ? (
					<Select
						value={selectedJobId ?? "latest"}
						onValueChange={(v) =>
							onSelectJob(v === "latest" ? null : (v ?? null))
						}
					>
						<SelectTrigger
							size="sm"
							aria-label="Check history"
							className="max-w-52 text-xs"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent
							align="start"
							alignItemWithTrigger={false}
							className="w-auto min-w-56"
						>
							<SelectItem value="latest">Latest result</SelectItem>
							{jobs.map((j) => (
								<SelectItem key={j.id} value={j.id}>
									{jobLabel(j)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}

				{sub.kind === "subscription" ? (
					<>
						<Button
							variant="success"
							size="sm"
							onClick={() => setAddNodeOpen(true)}
							aria-label="Add node"
							title="Add node"
						>
							<Cable size={13} />
							<span className="hidden sm:inline">Add node</span>
						</Button>

						<NodeSourceMenu
							subscriptionId={sub.id}
							hasUrl={!!sub.url}
							viaNode={!!sub.fetch_proxy_config}
						/>
					</>
				) : null}

				<ExportPopover subscriptionId={sub.id} />

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="outline"
								size="icon-sm"
							aria-label="Node group actions"
							/>
						}
					>
						<MoreHorizontal size={14} />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
						<DropdownMenuItem onClick={onToggleEnabled}>
							{sub.enabled ? "Disable" : "Enable"}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={onDelete}
							className="text-danger focus:text-danger"
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<RunCheckButton
					subscriptionId={sub.id}
					disabled={!sub.enabled || !!activeJobId}
					onStarted={onRunStarted}
				/>
			</div>

			{sub.kind === "subscription" ? (
				<AddNodeDialog
					open={addNodeOpen}
					onOpenChange={setAddNodeOpen}
					fixedSubscription={sub}
				/>
			) : null}
		</div>
	);
}
