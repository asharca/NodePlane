import { Inbox, Plus, SearchX } from "lucide-react";
import { useState } from "react";
import { SearchInput } from "@/components/asharca/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { type DotTone, StatusDot } from "@/components/ui/status-dot";
import type { checker, subscription } from "@/lib/client.gen";
import { filterGroups, type GroupFilter, groupDisplayName, groupSourceLabel, relativeTime } from "@/lib/group-view";
import { cn } from "@/lib/utils";

type Subscription = subscription.Subscription;
type LatestJobSummary = checker.LatestJobSummary;
function dotTone(group: Subscription, latest?: LatestJobSummary): DotTone {
	if (!group.enabled || !latest) return "neutral";
	if (latest.status === "running" || latest.status === "queued") return "info";
	return latest.status === "failed" ? "danger" : "success";
}
export function SubList({ subs, latestJobs, loading, selectedId, liveProgressPct, onSelect, onAdd }: {
	subs: Subscription[]; latestJobs: Record<string, LatestJobSummary>; loading: boolean;
	selectedId: string | null; liveProgressPct: number | null; onSelect: (id: string) => void; onAdd: () => void;
}) {
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<GroupFilter>("all");
	const visible = filterGroups(subs, search, filter);
	const filters = [{ id: "all", label: "All" }, { id: "enabled", label: "Enabled" }, { id: "paused", label: "Paused" }] as const;
	return <section aria-label="Node groups" className="flex h-full min-h-0 flex-col bg-card/60">
		<div className="shrink-0 space-y-4 p-4">
			<div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><h1 className="text-sm font-semibold">Node groups</h1><Badge>{loading ? "…" : subs.length}</Badge></div><Button size="icon-sm" aria-label="Add node group" title="Add node group" onClick={onAdd}><Plus className="size-4" /></Button></div>
			<SearchInput label="Search node groups" placeholder="Search groups…" value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} className="h-9" />
			<div role="group" aria-label="Filter node groups" className="flex gap-1 rounded-xl border border-border/60 bg-muted/60 p-1">{filters.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={cn("min-h-8 min-w-0 flex-1 rounded-lg px-2 text-xs font-medium transition-colors", filter === id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}</div>
		</div>
		<div aria-busy={loading} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3">
			{loading ? [0, 1, 2, 3].map((key) => <div key={key} className="space-y-3 rounded-xl border border-border/50 p-3.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/3" /></div>) : visible.length === 0 ? <EmptyState icon={subs.length ? SearchX : Inbox} title={subs.length ? "No matching groups" : "Your first node group"} description={subs.length ? "Try a different name or reset the filters." : "Add a subscription or a direct node to get started."} className="m-0 border-0 px-2 py-8" action={subs.length ? <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilter("all"); }}>Reset filters</Button> : <Button size="sm" onClick={onAdd}><Plus className="size-3.5" />Add group</Button>} /> : visible.map((sub) => {
				const latest = latestJobs[sub.id];
				const running = latest?.status === "running" || latest?.status === "queued";
				const selected = sub.id === selectedId;
				const percent = selected && liveProgressPct !== null ? Math.max(0, Math.min(100, Math.round(liveProgressPct))) : null;
				return <button key={sub.id} type="button" aria-pressed={selected} onClick={() => onSelect(sub.id)} className={cn("group w-full rounded-xl border p-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card", selected ? "border-primary/25 bg-background shadow-xs" : "border-transparent hover:border-border hover:bg-background/75")}>
					<div className="flex items-center gap-2"><StatusDot tone={dotTone(sub, latest)} pulse={running} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{groupDisplayName(sub)}</span>{!sub.enabled && <span className="text-[10px] text-muted-foreground">Paused</span>}</div>
					<p className="mt-1.5 truncate pl-4 text-xs text-muted-foreground">{groupSourceLabel(sub)}</p>
					<div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-4"><Badge tone={sub.kind === "node" ? "info" : "neutral"}>{sub.kind === "node" ? "Single node" : "Subscription"}</Badge><span className={cn("text-[11px] tabular-nums", latest?.status === "failed" ? "text-danger" : "text-muted-foreground")}>{running ? percent !== null ? `${percent}%` : latest?.status === "queued" ? "Queued" : "Running" : latest?.status === "failed" ? "Check failed" : latest?.status === "completed" ? `${latest.available}/${latest.total} alive` : "Not checked"}</span></div>
					{running && percent !== null ? <Progress value={percent} label={`Checking ${groupDisplayName(sub)}`} className="mt-3 h-1" /> : latest?.finished_at ? <p className="mt-2 pl-4 text-[10px] text-muted-foreground">Checked {relativeTime(latest.finished_at)}</p> : null}
				</button>;
			})}
		</div>
		<footer className="flex shrink-0 items-center justify-between border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground"><span>{loading ? "Loading groups…" : `${visible.length} of ${subs.length} groups`}</span><span>NodePlane</span></footer>
	</section>;
}
