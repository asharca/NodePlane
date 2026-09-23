import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			{...props}
			data-slot="switch"
			className={cn(
				"relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border bg-input outline-none motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary",
				className,
			)}
		>
			<SwitchPrimitive.Thumb className="block size-[18px] translate-x-0.5 rounded-full bg-white shadow-xs motion-safe:transition-transform data-checked:translate-x-[18px]" />
		</SwitchPrimitive.Root>
	);
}
export { Switch };
