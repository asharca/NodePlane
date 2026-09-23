import type { checker, subscription } from "@/lib/client.gen";
export type GroupFilter = "all" | "enabled" | "paused";
type GroupPreview = Pick<
	subscription.Subscription,
	"kind" | "url" | "name" | "enabled"
>;
type Snapshot = Pick<
	checker.LatestJobSummary,
	"status" | "available" | "total"
>;
export function groupSourceLabel(
	group: Pick<subscription.Subscription, "kind" | "url">,
): string {
	if (group.kind === "node") return "Direct share link";
	try {
		const url = new URL(group.url);
		return ["https:", "http:"].includes(url.protocol)
			? url.host
			: "Remote subscription";
	} catch {
		return "Remote subscription";
	}
}
export function groupDisplayName(
	group: Pick<subscription.Subscription, "kind" | "url" | "name">,
): string {
	return (
		group.name?.trim() ||
		(group.kind === "node" ? "Single node" : groupSourceLabel(group))
	);
}
export function filterGroups<T extends GroupPreview>(
	groups: T[],
	search: string,
	filter: GroupFilter,
): T[] {
	const query = search.trim().toLowerCase();
	return groups.filter(
		(group) =>
			(filter === "all" ||
				(filter === "enabled" ? group.enabled : !group.enabled)) &&
			`${groupDisplayName(group)} ${groupSourceLabel(group)} ${group.kind === "node" ? "single node" : "subscription"}`
				.toLowerCase()
				.includes(query),
	);
}
export function summarizeGroups(
	groups: Pick<subscription.Subscription, "id" | "enabled">[],
	latest: Record<string, Snapshot>,
) {
	const jobs = groups.flatMap((group) =>
		latest[group.id] ? [latest[group.id]] : [],
	);
	const completed = jobs.filter((job) => job.status === "completed");
	return {
		total: groups.length,
		enabled: groups.filter((group) => group.enabled).length,
		running: jobs.filter(
			(job) => job.status === "running" || job.status === "queued",
		).length,
		failed: jobs.filter((job) => job.status === "failed").length,
		completed: completed.length,
		available: completed.reduce((sum, job) => sum + job.available, 0),
		checked: completed.reduce((sum, job) => sum + job.total, 0),
	};
}
export function relativeTime(iso: string): string {
	const value = new Date(iso).getTime();
	if (!Number.isFinite(value)) return "Unknown time";
	const minutes = Math.floor(Math.max(0, Date.now() - value) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
	return `${Math.floor(minutes / 1440)}d ago`;
}
