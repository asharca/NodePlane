/// <reference types="vite/client" />
import {
	MutationCache,
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PlatformRulesProvider } from "@/components/platform-rules-context";
import { Toaster } from "@/components/ui/sonner";
import { isAuthenticated } from "@/lib/auth";
import { handleUnauthorized, isApiError } from "@/lib/client";
import appCss from "../styles.css?url";

// biome-ignore lint/complexity/noBannedTypes: intentionally empty context for TanStack Router
export type RouterAppContext = {};
const queryClient = new QueryClient({
	queryCache: new QueryCache({ onError: (err) => handleUnauthorized(err) }),
	mutationCache: new MutationCache({
		onError: (err) => handleUnauthorized(err),
	}),
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: (failureCount, err) => {
				if (isApiError(err) && err.status === 401) return false;
				return failureCount < 2;
			},
		},
	},
});
export const Route = createRootRouteWithContext<RouterAppContext>()({
	beforeLoad: ({ location }) => {
		if (typeof window === "undefined") return;
		const authed = isAuthenticated();
		const isLoginPage = location.pathname === "/login";
		if (!authed && !isLoginPage) throw redirect({ to: "/login" });
		if (authed && isLoginPage) throw redirect({ to: "/" });
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{ title: "NodePlane · Network workspace" },
			{
				name: "description",
				content:
					"Manage node groups, inspect connectivity and automate checks with NodePlane.",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
		],
	}),
	component: RootComponent,
});
function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: first-paint theme detection; no user content
					dangerouslySetInnerHTML={{
						__html: `(()=>{let s;try{s=localStorage.getItem("theme")}catch{}const t=s==="light"||s==="dark"?s:window.matchMedia?.("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark")})()`,
					}}
				/>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
function RootComponent() {
	const { location } = useRouterState();
	// Auth is client-side; keep SSR and the first hydration render identical.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const authed = mounted && isAuthenticated() && location.pathname !== "/login";
	return (
		<RootDocument>
			<QueryClientProvider client={queryClient}>
				{authed ? (
					<PlatformRulesProvider>
						<AppShell>
							<Outlet />
						</AppShell>
					</PlatformRulesProvider>
				) : (
					<div className="flex min-h-dvh items-center justify-center">
						<Outlet />
					</div>
				)}
				<Toaster richColors />
			</QueryClientProvider>
		</RootDocument>
	);
}
