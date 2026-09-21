import { Cable, Link2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { useImportNodes } from "@/queries";

type Subscription = subscription.Subscription;
type SubscriptionTarget = Pick<Subscription, "id" | "name" | "url">;

const protocolNames: Record<string, string> = {
	hysteria: "Hysteria",
	hysteria2: "Hysteria 2",
	ss: "Shadowsocks",
	trojan: "Trojan",
	tuic: "TUIC",
	vless: "VLESS",
	vmess: "VMess",
};

function detectProtocol(value: string): string | null {
	const scheme = value
		.trim()
		.match(/^([a-z0-9-]+):\/\//i)?.[1]
		.toLowerCase();
	return scheme ? (protocolNames[scheme] ?? scheme.toUpperCase()) : null;
}

export function AddNodeDialog({
	open,
	onOpenChange,
	subscriptions,
	fixedSubscription,
	defaultSubscriptionId = "",
	onCreateSubscription,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	subscriptions?: Subscription[];
	fixedSubscription?: SubscriptionTarget;
	defaultSubscriptionId?: string;
	onCreateSubscription?: () => void;
}) {
	const [subscriptionId, setSubscriptionId] = useState(defaultSubscriptionId);
	const [content, setContent] = useState("");
	const availableSubscriptions = subscriptions ?? [];
	const targetSubscriptionId =
		fixedSubscription?.id ||
		subscriptionId ||
		availableSubscriptions[0]?.id ||
		"";
	const protocol = detectProtocol(content);

	// Seed once per open; query rerenders must not clear text while editing.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only on open or target change
	useEffect(() => {
		if (!open) return;
		setSubscriptionId(
			defaultSubscriptionId || availableSubscriptions[0]?.id || "",
		);
		setContent("");
	}, [defaultSubscriptionId, open]);

	useEffect(() => {
		if (
			open &&
			!fixedSubscription &&
			!subscriptionId &&
			availableSubscriptions[0]?.id
		) {
			setSubscriptionId(availableSubscriptions[0].id);
		}
	}, [open, subscriptionId, fixedSubscription, availableSubscriptions]);

	const importMut = useImportNodes(targetSubscriptionId);

	const handleAdd = () => {
		const text = content.trim();
		if (!text) return;
		if (
			text
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean).length > 1
		) {
			toast.error("Paste one node link at a time");
			return;
		}
		if (!targetSubscriptionId) {
			toast.error("Choose a node group before adding a node");
			return;
		}
		importMut.mutate(
			{ content: text, append: true },
			{
				onSuccess: () => {
					toast.success("Node added");
					onOpenChange(false);
				},
				onError: (e) =>
					toast.error(isApiError(e) ? e.message : "Add node failed"),
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<div className="flex items-start gap-3 pr-8">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info">
						<Cable size={18} />
					</div>
					<div className="min-w-0">
						<DialogTitle>Add node</DialogTitle>
						<DialogDescription>
							Append one share link to a node group without replacing its
							existing nodes.
						</DialogDescription>
					</div>
				</div>

				<div className="mt-5 space-y-5">
					<div className="space-y-2">
						<Label className="text-xs">Destination group</Label>
						{fixedSubscription ? (
							<div className="flex items-center gap-3 rounded-lg border border-info-line bg-info-muted/40 px-3 py-2.5">
								<Link2 className="size-4 shrink-0 text-info" />
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-foreground text-sm">
										{fixedSubscription.name || "Current group"}
									</p>
									<p className="truncate font-mono text-[11px] text-muted-foreground">
										{fixedSubscription.url || "Manual nodes"}
									</p>
								</div>
								<Badge tone="info">Current</Badge>
							</div>
						) : availableSubscriptions.length > 0 ? (
							<Select
								value={targetSubscriptionId}
								onValueChange={(value) => setSubscriptionId(value ?? "")}
							>
								<SelectTrigger
									className="w-full"
									aria-label="Destination group"
								>
									<SelectValue placeholder="Choose a node group" />
								</SelectTrigger>
								<SelectContent align="start">
									{availableSubscriptions.map((sub) => (
										<SelectItem key={sub.id} value={sub.id}>
											{sub.name || sub.url}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<div className="flex items-center justify-between gap-3 rounded-lg border border-border border-dashed px-3 py-2.5">
								<div>
									<p className="font-medium text-foreground text-sm">
									No remote group yet
									</p>
									<p className="text-muted-foreground text-xs">
										Create a remote group before appending a node.
									</p>
								</div>
								{onCreateSubscription ? (
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											onOpenChange(false);
											onCreateSubscription();
										}}
									>
										<Plus size={13} /> Create
									</Button>
								) : null}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="node-link" className="text-xs">
								Share link
							</Label>
							{protocol ? <Badge tone="neutral">{protocol}</Badge> : null}
						</div>
						<textarea
							id="node-link"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={5}
							placeholder="vmess://..."
							className="min-h-32 w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs leading-5 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
						/>
						<p className="text-[11px] text-muted-foreground">
							One node per add. Existing nodes stay unchanged.
						</p>
					</div>
				</div>

				<DialogFooter className="mt-6">
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						variant="success"
						onClick={handleAdd}
						loading={importMut.isPending}
						disabled={!content.trim()}
					>
						<Cable size={14} /> Add node
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
