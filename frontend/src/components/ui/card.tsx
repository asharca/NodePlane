import type { ComponentProps } from "react";
import { Card as AsharcaCard } from "@/components/asharca/card";
import { cn } from "@/lib/utils";
function Card({ className, size = "default", ...props }: ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return <AsharcaCard {...props} padded={false} data-slot="card" data-size={size} className={cn("group/card flex flex-col gap-5 overflow-hidden py-5 text-sm data-[size=sm]:gap-3 data-[size=sm]:py-4 has-data-[slot=card-footer]:pb-0", className)} />;
}
function CardHeader({ className, ...props }: ComponentProps<"div">) { return <div {...props} data-slot="card-header" className={cn("grid auto-rows-min items-start gap-1.5 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] group-data-[size=sm]/card:px-4", className)} />; }
function CardTitle({ className, ...props }: ComponentProps<"div">) { return <div {...props} data-slot="card-title" className={cn("text-sm font-semibold leading-snug tracking-tight", className)} />; }
function CardDescription({ className, ...props }: ComponentProps<"div">) { return <div {...props} data-slot="card-description" className={cn("text-sm leading-6 text-muted-foreground", className)} />; }
function CardAction({ className, ...props }: ComponentProps<"div">) { return <div {...props} data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} />; }
function CardContent({ className, ...props }: ComponentProps<"div">) { return <div {...props} data-slot="card-content" className={cn("px-5 group-data-[size=sm]/card:px-4", className)} />; }
function CardFooter({ className, ...props }: ComponentProps<"div">) { return <div {...props} data-slot="card-footer" className={cn("flex flex-wrap items-center gap-2 border-t border-border bg-muted/25 px-5 py-4 group-data-[size=sm]/card:px-4", className)} />; }
export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
