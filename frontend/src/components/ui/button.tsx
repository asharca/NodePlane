import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Button as AsharcaButton } from "@/components/asharca/button";
import { cn } from "@/lib/utils";

// Keep Base UI's render/event/ref contract, using the real Asharca button as its element.
const buttonVariants = cva(
	"group/button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-xl border border-transparent font-medium outline-none motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:opacity-90",
				outline:
					"border-border bg-background text-foreground hover:bg-muted aria-expanded:bg-muted",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/75",
				ghost:
					"bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
				destructive:
					"bg-danger-muted text-danger hover:bg-danger-muted/75 focus-visible:ring-danger/30",
				"destructive-solid":
					"bg-danger text-white hover:opacity-90 focus-visible:ring-danger/30",
				success:
					"bg-solid-success text-white hover:opacity-90 focus-visible:ring-success/30",
				link: "bg-transparent text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 gap-2 px-3.5 text-sm",
				xs: "h-7 gap-1.5 rounded-lg px-2 text-xs",
				sm: "h-8 gap-1.5 px-3 text-xs",
				lg: "h-11 gap-2 px-5 text-sm",
				icon: "size-9 p-0",
				"icon-xs": "size-7 rounded-lg p-0",
				"icon-sm": "size-8 p-0",
				"icon-lg": "size-11 p-0",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);
function Button({
	className,
	variant = "default",
	size = "default",
	loading = false,
	disabled,
	children,
	render,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & { loading?: boolean }) {
	return (
		<ButtonPrimitive
			{...props}
			render={render ?? <AsharcaButton loading={loading} />}
			data-slot="button"
			aria-busy={loading || undefined}
			className={cn(buttonVariants({ variant, size, className }))}
			disabled={disabled || loading}
		>
			{/* Asharca owns its loader; only custom render targets need an adapter loader. */}
			{loading && render && (
				<LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
			)}
			{children}
		</ButtonPrimitive>
	);
}
export { Button, buttonVariants };
