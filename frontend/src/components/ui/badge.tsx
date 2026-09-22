import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { Badge as AsharcaBadge } from "@/components/asharca/badge";
import { cn } from "@/lib/utils";
const badgeVariants = cva(
	"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-[11px] leading-none",
	{
		variants: {
			tone: {
				success:
					"border-success-line bg-success-muted text-success dark:text-success",
				danger:
					"border-danger-line bg-danger-muted text-danger dark:text-danger",
				warning:
					"border-warning-line bg-warning-muted text-warning dark:text-warning",
				info: "border-info-line bg-info-muted text-info",
				neutral: "border-border bg-secondary text-muted-foreground",
			},
		},
		defaultVariants: { tone: "neutral" },
	},
);
function Badge({
	className,
	tone,
	...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<AsharcaBadge
			{...props}
			tone={
				tone === "danger"
					? "error"
					: tone === "info"
						? "neutral"
						: (tone ?? "neutral")
			}
			className={cn(badgeVariants({ tone }), className)}
		/>
	);
}
export { Badge, badgeVariants };
