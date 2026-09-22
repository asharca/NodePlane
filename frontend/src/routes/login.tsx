import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Eye, EyeOff, Layers3, Moon, Radar, Sun } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/asharca/card";
import { Checkbox } from "@/components/asharca/checkbox";
import { Input } from "@/components/asharca/input";
import { NodePlaneBrand } from "@/components/nodeplane-brand";
import { Button } from "@/components/ui/button";
import { setToken } from "@/lib/auth";
import { isApiError } from "@/lib/client";
import { useTheme } from "@/lib/theme";
import { useLogin, useRegister } from "@/queries";
export const Route = createFileRoute("/login")({ component: LoginPage });
function LoginPage() {
	const navigate = useNavigate();
	const { theme, toggle } = useTheme();
	const [mode, setMode] = useState<"login" | "register">("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [remember, setRemember] = useState(false);
	const [inviteCode, setInviteCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const loginMut = useLogin();
	const registerMut = useRegister();
	const pending = loginMut.isPending || registerMut.isPending;
	function submit(event: FormEvent) {
		event.preventDefault();
		if (pending || !username.trim() || !password || (mode === "register" && !inviteCode.trim())) return;
		setError(null);
		const onError = (err: unknown) => setError(isApiError(err) ? err.message : mode === "login" ? "Unable to sign in. Please try again." : "Unable to create your account. Please try again.");
		if (mode === "login") loginMut.mutate({ username: username.trim(), password, remember }, { onSuccess: (response) => { setToken(response.token, remember); void navigate({ to: "/" }); }, onError });
		else registerMut.mutate({ username: username.trim(), password, invite_code: inviteCode.trim() }, { onSuccess: () => { toast.success("Account created — please sign in"); setMode("login"); setPassword(""); }, onError });
	}
	return <main className="flex min-h-dvh w-full flex-col bg-[var(--workspace-shell-background)]">
		<header className="flex items-center justify-between px-6 py-5 sm:px-10"><NodePlaneBrand /><Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle}>{theme === "dark" ? <Sun /> : <Moon />}</Button></header>
		<div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-8 sm:px-10 lg:grid-cols-2 lg:gap-20">
			<section className="hidden py-10 lg:block"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">The NodePlane workspace</p><h1 className="max-w-lg text-5xl font-semibold leading-[1.12] tracking-[-0.04em]">A clearer view of<br /><span className="text-primary">your network.</span></h1><p className="mt-6 max-w-md text-base leading-8 text-muted-foreground">Bring subscriptions, node diagnostics and automated checks into one focused workspace.</p><div className="mt-10 space-y-6">{[{ icon: Layers3, title: "One place for every node", text: "Organize remote subscriptions and direct node links." }, { icon: Radar, title: "Inspect what matters", text: "Review connectivity, latency and platform access." }, { icon: CalendarClock, title: "Build your own routine", text: "Schedule repeat checks and configure notifications." }].map(({ icon: Icon, title, text }) => <div key={title} className="flex items-start gap-4"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-background"><Icon className="size-5 text-primary" /></span><div><h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></div>)}</div></section>
			<Card className="mx-auto w-full max-w-md p-6 shadow-[var(--shadow-popover)] sm:p-8"><h2 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Sign in to continue to your workspace." : "Use your invitation to join NodePlane."}</p>
				<form onSubmit={submit} aria-busy={pending} className="mt-7 space-y-5">
					{error && <div role="alert" className="rounded-xl border border-danger-line bg-danger-muted px-4 py-3 text-sm leading-6 text-danger">{error}</div>}
					<Input label="Username" name="username" value={username} autoComplete="username" required disabled={pending} placeholder="Enter your username" onChange={(event) => setUsername(event.target.value)} />
					<div className="relative"><Input label="Password" name="password" type={showPassword ? "text" : "password"} value={password} autoComplete={mode === "login" ? "current-password" : "new-password"} required disabled={pending} placeholder="Enter your password" className="pr-12" onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute top-8 right-1.5 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
					{mode === "register" && <Input label="Invite code" name="invite-code" value={inviteCode} required disabled={pending} autoComplete="off" description="An invitation from your workspace administrator." onChange={(event) => setInviteCode(event.target.value)} />}
					{mode === "login" && <Checkbox label="Remember me" checked={remember} disabled={pending} onChange={(event) => setRemember(event.target.checked)} />}
					<Button type="submit" size="lg" className="w-full" loading={pending} disabled={!username.trim() || !password || (mode === "register" && !inviteCode.trim())}>{mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></Button>
				</form><div className="mt-6 border-t border-border pt-5 text-center"><Button variant="link" disabled={pending} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setShowPassword(false); }}>{mode === "login" ? "Have an invitation? Create an account" : "Already have an account? Sign in"}</Button></div>
			</Card>
		</div><footer className="px-5 py-6 text-center text-xs text-muted-foreground">NodePlane · Your network, in focus.</footer>
	</main>;
}
