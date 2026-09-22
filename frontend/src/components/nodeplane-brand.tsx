import { Network } from "lucide-react";
import { cn } from "@/lib/utils";

export function NodePlaneBrand({ compact = false, className }: { compact?: boolean; className?: string }) {
	return <span className={cn("inline-flex items-center gap-2.5", className)}>
		<span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><Network className="size-5" strokeWidth={1.8} /></span>
		{!compact && <span className="text-sm font-semibold tracking-tight">NodePlane</span>}
	</span>;
}
