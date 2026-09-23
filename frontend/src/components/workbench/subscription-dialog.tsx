import { Cable, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { isApiError } from "@/lib/client";
import type { subscription } from "@/lib/client.gen";
import { useCreateNodeGroup, useUpdateSubscription } from "@/queries";

type NodeGroup = subscription.Subscription;
type GroupKind = "subscription" | "node";

function isValidHttpUrl(value: string): boolean {
	try {
		const u = new URL(value);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

function detectProtocol(value: string): string | null {
	const scheme = value.trim().match(/^([a-z0-9-]+):\/\//i)?.[1];
	return scheme ? scheme.toUpperCase() : null;
}

// One dialog for both node-group creation and editing.
export function NodeGroupDialog({
	open,
	onOpenChange,
	sub,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sub?: NodeGroup | null;
}) {
	const editing = !!sub;
	const [kind, setKind] = useState<GroupKind>("subscription");
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [nodeContent, setNodeContent] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [urlError, setUrlError] = useState<string | null>(null);
	const [nodeError, setNodeError] = useState<string | null>(null);
	const [includeDead, setIncludeDead] = useState(false);
	const [exportSort, setExportSort] = useState("speed_desc");

	useEffect(() => {
		if (open) {
			setKind(sub?.kind === "node" ? "node" : "subscription");
			setName(sub?.name ?? "");
			setUrl(sub?.url ?? "");
			setNodeContent("");
			setEnabled(sub?.enabled ?? true);
			setIncludeDead(sub?.export_include_dead ?? false);
			setExportSort(sub?.export_sort ?? "speed_desc");
			setUrlError(null);
			setNodeError(null);
		}
	}, [open, sub]);

	const createMut = useCreateNodeGroup();
	const updateMut = useUpdateSubscription();
	const pending = createMut.isPending || updateMut.isPending;
	const protocol = detectProtocol(nodeContent);

	function submit() {
		const trimmedUrl = url.trim();
		const trimmedNode = nodeContent.trim();
		if (kind === "subscription" && !isValidHttpUrl(trimmedUrl)) {
			setUrlError("Must be a valid http(s) URL");
			return;
		}
		if (kind === "node" && !editing && !trimmedNode) {
			setNodeError("Paste one node share link");
			return;
		}
		setUrlError(null);
		setNodeError(null);
		const onError = (e: unknown) =>
			toast.error(e instanceof Error ? e.message : isApiError(e) ? e.message : "Request failed");

		if (editing && sub) {
			updateMut.mutate(
				{
					id: sub.id,
					params: {
						name: name.trim(),
						url: kind === "subscription" ? trimmedUrl : "",
						enabled,
						cron_expr: sub.cron_expr ?? "",
						clear_cron_expr: false,
						export_include_dead: includeDead,
						export_sort: exportSort,
					},
				},
				{
					onSuccess: () => {
						toast.success("Node group updated");
						onOpenChange(false);
					},
					onError,
				},
			);
			return;
		}

		createMut.mutate(
			{
				params: {
					kind,
					name: name.trim() || (kind === "node" ? "Single node" : ""),
					url: kind === "subscription" ? trimmedUrl : "",
					cron_expr: "",
					export_include_dead: includeDead,
					export_sort: exportSort,
				},
				nodeContent: kind === "node" ? trimmedNode : undefined,
			},
			{
				onSuccess: () => {
					toast.success("Node group added");
					onOpenChange(false);
				},
				onError,
			},
		);
	}

	const submitDisabled =
		kind === "subscription" ? !url.trim() : !editing && !nodeContent.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<div className="flex items-start gap-3 pr-8">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info">
						<Cable size={18} />
					</div>
					<div className="min-w-0">
						<DialogTitle>
							{editing ? "Edit node group" : "Add node group"}
						</DialogTitle>
						<DialogDescription>
							Choose a remote subscription or add one node directly.
						</DialogDescription>
					</div>
				</div>

				<div className="mt-5 space-y-5">
					<div className="space-y-2">
						<Label className="text-xs">Group type</Label>
						<div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
							{(
								[
									["subscription", "Subscription", "Keep nodes synced from a URL"],
									["node", "Single node", "Save one share link directly"],
								] as const
							).map(([value, label, hint]) => (
								<button
									key={value}
									type="button"
									disabled={editing}
									aria-pressed={kind === value}
									onClick={() => setKind(value)}
									className={
										kind === value
											? "rounded-md bg-background px-3 py-2 text-left shadow-sm ring-1 ring-border"
											: "rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-background/70"
									}
								>
									<span className="block font-medium text-sm">{label}</span>
									<span className="mt-0.5 block text-[11px]">{hint}</span>
								</button>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="group-name" className="text-xs">
							Name <span className="text-muted-foreground">(optional)</span>
						</Label>
						<Input
							id="group-name"
							value={name}
							placeholder={kind === "node" ? "My server" : "My provider"}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					{kind === "subscription" ? (
						<div className="space-y-1.5">
							<Label htmlFor="group-url" className="text-xs">
								Subscription URL
							</Label>
							<Input
								id="group-url"
								value={url}
								placeholder="https://…"
								className="font-mono"
								aria-invalid={!!urlError}
								onChange={(e) => {
									setUrl(e.target.value);
									if (urlError) setUrlError(null);
								}}
							/>
							{urlError ? (
								<p className="text-danger text-xs">{urlError}</p>
							) : null}
						</div>
					) : editing ? (
						<div className="flex items-center gap-3 rounded-lg border border-info-line bg-info-muted/40 px-3 py-2.5">
							<Link2 className="size-4 shrink-0 text-info" />
							<p className="text-muted-foreground text-xs">
								This group stores a directly imported node.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="group-node" className="text-xs">
									Node share link
								</Label>
								{protocol ? <Badge tone="neutral">{protocol}</Badge> : null}
							</div>
							<textarea
								id="group-node"
								value={nodeContent}
								onChange={(e) => {
									setNodeContent(e.target.value);
									if (nodeError) setNodeError(null);
								}}
								rows={5}
								placeholder="vmess://..."
								aria-invalid={!!nodeError}
								className="min-h-32 w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs leading-5 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
							/>
							<p className="text-[11px] text-muted-foreground">
								Paste one vmess, vless, ss, trojan, hysteria or tuic link.
							</p>
							{nodeError ? (
								<p className="text-danger text-xs">{nodeError}</p>
							) : null}
						</div>
					)}

					{editing ? (
						<label className="flex cursor-pointer items-center gap-2 text-sm">
							<Checkbox
								checked={enabled}
								onCheckedChange={(v) => setEnabled(v === true)}
							/>
							Enabled
						</label>
					) : null}

					<div className="space-y-1.5">
						<Label htmlFor="group-sort" className="text-xs">
							Export order
						</Label>
						<Select
							value={exportSort}
							onValueChange={(v) => v && setExportSort(v)}
						>
							<SelectTrigger id="group-sort" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="speed_desc">
									Download speed (high→low)
								</SelectItem>
								<SelectItem value="latency_asc">Latency (low→high)</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<label className="flex cursor-pointer items-center gap-2 text-sm">
						<Checkbox
							checked={includeDead}
							onCheckedChange={(v) => setIncludeDead(v === true)}
						/>
						Include dead nodes in export
					</label>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="success"
						loading={pending}
						disabled={submitDisabled}
						onClick={submit}
					>
						{editing ? "Save" : "Add group"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Kept as a source-compatible alias for routes/components outside the main workbench.
export const SubscriptionDialog = NodeGroupDialog;
