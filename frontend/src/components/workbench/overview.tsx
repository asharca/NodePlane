import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CalendarClock,
	Layers3,
	Plus,
	Radar,
	ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/asharca/card";
import { Page, PageHeader } from "@/components/asharca/page";
import { RequestError } from "@/components/request-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { checker, subscription } from "@/lib/client.gen";
import {
	groupDisplayName,
	groupSourceLabel,
	summarizeGroups,
} from "@/lib/group-view";

export function WorkbenchOverview({
	subs,
	latestJobs,
	loading,
	summaryError,
	onRetry,
	onAdd,
	onSelect,
}: {
	subs: subscription.Subscription[];
	latestJobs: Record<string, checker.LatestJobSummary>;
	loading: boolean;
	summaryError: boolean;
	onRetry: () => void;
	onAdd: () => void;
	onSelect: (id: string) => void;
}) {
	const stats = summarizeGroups(subs, latestJobs);
	return (
		<div className="h-full overflow-y-auto">
			<Page as="div" className="max-w-6xl lg:p-8">
				<PageHeader
					headingLevel={2}
					title="Your network, at a glance"
					description="One workspace for your subscriptions, node checks and automation."
					actions={
						<Button onClick={onAdd}>
							<Plus className="size-4" />
							Add node group
						</Button>
					}
				/>
				{loading ? (
					<div className="grid gap-4 sm:grid-cols-3">
						{[0, 1, 2].map((key) => (
							<Skeleton key={key} className="h-28 rounded-2xl" />
						))}
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-3">
						<Card>
							<p className="text-xs text-muted-foreground">Node groups</p>
							<p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
								{stats.total}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{stats.enabled} enabled · {stats.total - stats.enabled} paused
							</p>
						</Card>
						<Card>
							<p className="text-xs text-muted-foreground">
								Checks in progress
							</p>
							<p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
								{summaryError ? "—" : stats.running}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								Running or queued in the latest snapshot
							</p>
						</Card>
						<Card>
							<p className="text-xs text-muted-foreground">
								Available in completed checks
							</p>
							<p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
								{summaryError || !stats.completed ? "—" : stats.available}
								<span className="ml-1 text-base font-normal text-muted-foreground">
									{!summaryError && stats.completed > 0
										? `/ ${stats.checked}`
										: ""}
								</span>
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								Latest completed snapshots, not live health
							</p>
						</Card>
					</div>
				)}
				{summaryError && (
					<RequestError
						title="Check summaries are unavailable"
						description="Your groups are still available. Retry to load their latest check status."
						onRetry={onRetry}
					/>
				)}
				{!loading && subs.length === 0 ? (
					<Card className="relative overflow-hidden bg-muted/25 p-6 sm:p-8">
						<div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
							<Layers3 className="size-6" />
						</div>
						<h2 className="text-xl font-semibold tracking-tight">
							Bring your nodes together.
						</h2>
						<p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
							Add a subscription URL or a direct node link. Run a check to
							inspect availability, latency, transfer speed and platform access.
						</p>
						<Button className="mt-6" onClick={onAdd}>
							Create your first group
							<ArrowRight className="size-4" />
						</Button>
					</Card>
				) : (
					!loading && (
						<Card padded={false} className="overflow-hidden">
							<div className="flex items-center justify-between border-b border-border px-5 py-4">
								<h2 className="text-sm font-semibold">Open a node group</h2>
								<span className="text-xs text-muted-foreground">
									{Math.min(subs.length, 6)} shown
								</span>
							</div>
							<div className="divide-y divide-border">
								{subs.slice(0, 6).map((sub) => (
									<button
										key={sub.id}
										type="button"
										onClick={() => onSelect(sub.id)}
										className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
									>
										<span
											aria-hidden="true"
											className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
										>
											<Layers3 className="size-4" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium">
												{groupDisplayName(sub)}
											</span>
											<span className="mt-1 block truncate text-xs text-muted-foreground">
												{groupSourceLabel(sub)}
											</span>
										</span>
										<Badge tone={sub.enabled ? "success" : "neutral"}>
											{sub.enabled ? "Enabled" : "Paused"}
										</Badge>
										<ArrowRight
											aria-hidden="true"
											className="size-4 shrink-0 text-muted-foreground"
										/>
									</button>
								))}
							</div>
						</Card>
					)
				)}
				<div className="grid gap-4 xl:grid-cols-3">
					{[
						{
							icon: ShieldCheck,
							title: "Inspect connectivity",
							description:
								"Select a group to check nodes and inspect detailed results.",
						},
						{
							icon: CalendarClock,
							title: "Automate your checks",
							description:
								"Use schedules to repeat checks without manual runs.",
							to: "/scheduler" as const,
						},
						{
							icon: Radar,
							title: "Make rules your own",
							description:
								"Inspect and test the rules used for platform detection.",
							to: "/rules" as const,
						},
					].map(({ icon: Icon, title, description, to }) => (
						<Card key={title} muted className="border-transparent">
							<Icon
								aria-hidden="true"
								className="mb-3 size-5 text-muted-foreground"
							/>
							<h3 className="text-sm font-medium">{title}</h3>
							<p className="mt-2 text-xs leading-6 text-muted-foreground">
								{description}
							</p>
							{to && (
								<Link
									to={to}
									className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"
								>
									Open
									<ArrowRight className="size-3" />
								</Link>
							)}
						</Card>
					))}
				</div>
			</Page>
		</div>
	);
}
