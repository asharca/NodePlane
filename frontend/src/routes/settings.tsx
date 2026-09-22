import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Bell, Download, Settings2, Tags, UserRound } from "lucide-react";
import { Page, PageHeader } from "@/components/asharca/page";
export const Route = createFileRoute("/settings")({ component: SettingsLayout });
const TABS = [
	{ to: "/settings/general" as const, label: "General", icon: Settings2 },
	{ to: "/settings/notify" as const, label: "Notifications", icon: Bell },
	{ to: "/settings/export" as const, label: "Export API", icon: Download },
	{ to: "/settings/export-tags" as const, label: "Export tags", icon: Tags },
	{ to: "/settings/account" as const, label: "Account", icon: UserRound },
];
function SettingsLayout() {
	return <div className="h-full overflow-y-auto"><Page as="div" className="max-w-6xl pb-10"><PageHeader title="Settings" description="Make the workspace work for you. Manage checking defaults, delivery and access." />
		<div className="grid min-w-0 items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
			<nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-2xl bg-muted/50 p-2 lg:sticky lg:top-0 lg:flex-col">{TABS.map(({ to, label, icon: Icon }) => <Link key={to} to={to} activeProps={{ className: "bg-background text-foreground shadow-xs", "aria-current": "page" }} inactiveProps={{ className: "text-muted-foreground hover:bg-background/60 hover:text-foreground" }} className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors"><Icon aria-hidden="true" className="size-4" />{label}</Link>)}</nav>
			<div className="settings-content min-w-0 rounded-2xl border border-border bg-background p-4 sm:p-6"><Outlet /></div>
		</div>
	</Page></div>;
}
