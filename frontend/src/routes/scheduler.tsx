import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/asharca/card";
import { Page, PageHeader } from "@/components/asharca/page";
import { SearchInput } from "@/components/asharca/search-input";
import { RequestError } from "@/components/request-state";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { isApiError } from "@/lib/client";
import type { scheduler } from "@/lib/client.gen";
import { describeCron, formatUntil, nextRun } from "@/lib/cron";
import { groupDisplayName } from "@/lib/group-view";
import { useDeleteScheduledJob, useLatestJobs, useScheduledJobs, useSetScheduleEnabled, useSubscriptions } from "@/queries";
type ScheduledJob = scheduler.ScheduledJob;
export const Route = createFileRoute("/scheduler")({ component: SchedulerPage });
function SchedulerPage() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<ScheduledJob | null>(null);
	const [deleting, setDeleting] = useState<ScheduledJob | null>(null);
	const [search, setSearch] = useState("");
	const jobsQuery = useScheduledJobs();
	const subsQuery = useSubscriptions();
	const latestQuery = useLatestJobs();
	const jobs = jobsQuery.data?.jobs ?? [];
	const subs = subsQuery.data?.subscriptions ?? [];
	const latestJobs = latestQuery.data?.jobs ?? {};
	const subName = (id: string) => { const sub = subs.find((item) => item.id === id); return sub ? groupDisplayName(sub) : id.slice(0, 8); };
	const toggleMut = useSetScheduleEnabled();
	const deleteMut = useDeleteScheduledJob();
	const visible = jobs.filter((job) => `${subName(job.subscription_id)} ${job.cron_expr} ${describeCron(job.cron_expr)}`.toLowerCase().includes(search.trim().toLowerCase()));
	function openNew() { setEditing(null); setDialogOpen(true); }
	function handleToggle(job: ScheduledJob, enabled: boolean) { toggleMut.mutate({ id: job.id, enabled }, { onError: (error) => toast.error(isApiError(error) ? error.message : "Failed to update") }); }
	function handleDelete() {
		if (!deleting) return;
		deleteMut.mutate(deleting.id, { onSuccess: () => { toast.success("Schedule deleted"); setDeleting(null); }, onError: (error) => toast.error(isApiError(error) ? error.message : "Delete failed") });
	}
	return <div className="h-full overflow-y-auto"><Page as="div" className="max-w-6xl pb-10">
		<PageHeader title="Scheduler" description="Set your checking routine. Keep recurring work out of your way." actions={<Button onClick={openNew} disabled={subsQuery.isLoading || subsQuery.isError}><Plus className="size-4" />New schedule</Button>} />
		{subsQuery.isError && <RequestError title="Node groups could not be loaded" description="Retry before creating or editing a schedule." onRetry={() => void subsQuery.refetch()} retrying={subsQuery.isFetching} />}
		{jobsQuery.isError ? <RequestError title="Schedules could not be loaded" onRetry={() => void jobsQuery.refetch()} retrying={jobsQuery.isFetching} /> : jobsQuery.isLoading ? <div className="space-y-4"><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div> : <>
			<div className="grid grid-cols-3 gap-3 sm:gap-4">{[{ label: "Total schedules", value: jobs.length }, { label: "Enabled", value: jobs.filter((job) => job.enabled).length }, { label: "Paused", value: jobs.filter((job) => !job.enabled).length }].map((item) => <Card key={item.label} className="p-4 sm:p-5"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p></Card>)}</div>
			<Card padded={false} className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-5"><div><h2 className="text-sm font-semibold">Scheduled checks</h2><p className="mt-1 text-xs text-muted-foreground">Next-run times are estimates in your browser's timezone.</p></div><SearchInput label="Search schedules" value={search} placeholder="Search schedules…" onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} className="w-full sm:w-60" /></div>
				{jobs.length === 0 ? <EmptyState icon={CalendarClock} title="Put your checks on a schedule" description="Create a recurring check for a node group. You can pause it at any time." action={<Button onClick={openNew} disabled={subsQuery.isLoading || subsQuery.isError}>New schedule</Button>} /> : visible.length === 0 ? <EmptyState icon={CalendarClock} title="No matching schedules" description="Try a group name or a cron expression." action={<Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>} /> : <div className="overflow-x-auto"><table className="surface-table min-w-[720px]"><caption className="sr-only">Recurring checks, next-run estimates, and schedule controls</caption><thead><tr><th scope="col">Node group</th><th scope="col">Schedule</th><th scope="col">Next run</th><th scope="col">Latest group check</th><th scope="col">Enabled</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((job) => {
					const name = subName(job.subscription_id);
					const next = job.enabled ? nextRun(job.cron_expr) : null;
					const latest = latestJobs[job.subscription_id];
					return <tr key={job.id}><td><button type="button" disabled={subsQuery.isLoading || subsQuery.isError} className="max-w-52 truncate text-left font-medium hover:text-primary hover:underline" onClick={() => { setEditing(job); setDialogOpen(true); }}>{name}</button></td><td><p className="max-w-64 leading-6">{describeCron(job.cron_expr)}</p><code className="mt-1 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{job.cron_expr}</code></td><td className="whitespace-nowrap"><span className={job.enabled ? "font-medium text-primary" : "text-muted-foreground"} title={next?.toLocaleString()}>{next ? formatUntil(next) : job.enabled ? "Unavailable" : "Paused"}</span></td><td>{latestQuery.isError ? <span className="text-muted-foreground">Unavailable</span> : latestQuery.isLoading ? <Skeleton className="h-5 w-20" /> : latest ? <div className="space-y-2"><Badge tone={latest.status === "completed" ? "success" : latest.status === "failed" ? "danger" : "info"}>{latest.status}</Badge><p className="text-[11px] text-muted-foreground">{new Date(latest.finished_at ?? latest.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div> : <span className="text-muted-foreground">Not checked</span>}</td><td><Switch aria-label={`Enable schedule for ${name}`} checked={job.enabled} onCheckedChange={(value) => handleToggle(job, value)} disabled={toggleMut.isPending} /></td><td><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Edit schedule for ${name}`} disabled={subsQuery.isLoading || subsQuery.isError} onClick={() => { setEditing(job); setDialogOpen(true); }}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Delete schedule for ${name}`} className="hover:bg-danger-muted hover:text-danger" onClick={() => setDeleting(job)}><Trash2 className="size-3.5" /></Button></div></td></tr>;
				})}</tbody></table></div>}
			</Card>
		</>}
		<ScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} subs={subs} editing={editing} />
		<ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title={`Delete schedule for "${deleting ? subName(deleting.subscription_id) : ""}"?`} description="Automatic checks for this node group will stop. The group itself is not affected." pending={deleteMut.isPending} onConfirm={handleDelete} />
	</Page></div>;
}
