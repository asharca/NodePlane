import type { ComponentProps } from "react";
import { Progress as AsharcaProgress } from "@/components/asharca/progress";
import { cn } from "@/lib/utils";
export function Progress({
	value,
	label = "Check progress",
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	value?: number | null;
	label?: string;
}) {
	return (
		<AsharcaProgress
			{...props}
			label={label}
			value={value ?? undefined}
			showValue={false}
			className={cn(
				"relative h-1.5 gap-0 [&>div:first-child]:sr-only [&>div:last-child]:h-full",
				className,
			)}
		/>
	);
}
