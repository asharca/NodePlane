import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronRight, LogOut, Menu, Moon, Settings2, Sun, UserRound } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/asharca/workspace-shell";
import { WorkspaceSidebar } from "@/components/asharca/workspace-sidebar";
import { NodePlaneBrand } from "@/components/nodeplane-brand";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearToken } from "@/lib/auth";
import { getWorkspacePage, WORKSPACE_NAV } from "@/lib/navigation";
import { useTheme } from "@/lib/theme";
import { useMe } from "@/queries";

const SIDEBAR_KEY = "nodeplane:sidebar-collapsed";
const navigationGroups = [{ id: "workspace", title: "WORKSPACE", items: WORKSPACE_NAV.map(({ id, label, icon: Icon }) => ({ id, label, icon: <Icon /> })) }];

export function AppShell({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { theme, toggle } = useTheme();
	const { data: me } = useMe();
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const page = getWorkspacePage(pathname);
	const username = me?.display_name || me?.username || "Your account";
	useEffect(() => {
		try { const saved = window.localStorage.getItem(SIDEBAR_KEY); setCollapsed(saved === null ? window.innerWidth < 1180 : saved === "true"); }
		catch { setCollapsed(window.innerWidth < 1180); }
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: close navigation after route changes
	useEffect(() => { setMobileOpen(false); }, [pathname]);
	function changeCollapsed(value: boolean) {
		setCollapsed(value);
		try { window.localStorage.setItem(SIDEBAR_KEY, String(value)); } catch { /* Storage is optional. */ }
	}
	function logout() {
		clearToken();
		queryClient.clear();
		void navigate({ to: "/login" });
	}
	return <>
		<a href="#main-content" className="skip-link">Skip to content</a>
		<WorkspaceShell className="h-dvh" scroll="none"
			sidebar={<WorkspaceSidebar variant="inset" title="NodePlane" groups={navigationGroups} activeId={page.id}
				collapsed={collapsed} onCollapsedChange={changeCollapsed} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen}
				onSelect={(id) => { const target = WORKSPACE_NAV.find((item) => item.id === id); if (target) void navigate({ to: target.to }); }}
				footer={<div className="rounded-xl border border-border/60 bg-background/60 p-3"><p className="text-xs font-medium">Your network, in focus.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Subscriptions, checks and automation in one workspace.</p></div>} />}
			mobileHeader={<><Button variant="ghost" size="icon" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu /></Button><NodePlaneBrand /></>}
			header={<header className="flex h-14 min-w-0 items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-5">
				<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-xs"><Link to="/" className="hidden shrink-0 text-muted-foreground hover:text-foreground sm:inline">Workspace</Link><ChevronRight aria-hidden="true" className="hidden size-3.5 text-muted-foreground/60 sm:block" /><span aria-current="page" className="truncate font-medium">{page.label}</span></nav>
				<div className="flex shrink-0 items-center gap-1.5">
					<Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle}>{theme === "dark" ? <Sun /> : <Moon />}</Button>
					<DropdownMenu><DropdownMenuTrigger aria-label="Account menu" className="grid size-9 place-items-center rounded-xl border border-border bg-muted/60 text-xs font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{me ? username.slice(0, 1).toUpperCase() : <UserRound className="size-4" />}</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5"><div className="mb-1 border-b border-border px-2 py-2.5"><p className="text-xs text-muted-foreground">Signed in as</p><p className="mt-1 truncate text-sm font-medium">{username}</p></div><DropdownMenuItem onClick={() => void navigate({ to: "/settings/account" })}><Settings2 className="size-4" />Account settings</DropdownMenuItem><DropdownMenuItem onClick={logout}><LogOut className="size-4" />Log out</DropdownMenuItem></DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>}>
			<main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none">{children}</main>
		</WorkspaceShell>
	</>;
}
