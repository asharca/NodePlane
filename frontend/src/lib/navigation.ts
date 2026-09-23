import { CalendarClock, Layers3, Radar, Settings2 } from "lucide-react";

export const WORKSPACE_NAV = [
	{ id: "groups", to: "/", label: "Node groups", icon: Layers3 },
	{
		id: "scheduler",
		to: "/scheduler",
		label: "Scheduler",
		icon: CalendarClock,
	},
	{ id: "rules", to: "/rules", label: "Platform rules", icon: Radar },
	{
		id: "settings",
		to: "/settings/general",
		label: "Settings",
		icon: Settings2,
	},
] as const;

export function getWorkspacePage(pathname: string) {
	if (pathname === "/scheduler" || pathname.startsWith("/scheduler/"))
		return WORKSPACE_NAV[1];
	if (pathname === "/rules" || pathname.startsWith("/rules/"))
		return WORKSPACE_NAV[2];
	if (pathname === "/settings" || pathname.startsWith("/settings/"))
		return WORKSPACE_NAV[3];
	return WORKSPACE_NAV[0];
}
