import { cloneElement, useId, type ReactElement, type ComponentPropsWithRef } from "react";
import { Label } from "@/components/ui/label";

type Control = ComponentPropsWithRef<"input">;
export function FormField({ label, error, children }: { label: string; error?: string; children: ReactElement<Control> }) {
	const generated = useId();
	const id = children.props.id ?? generated;
	const description = [children.props["aria-describedby"], error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;
	return <div className="space-y-1.5">
		<Label htmlFor={id} className="text-xs">{label}</Label>
		{cloneElement(children, { id, "aria-describedby": description, "aria-invalid": error ? true : children.props["aria-invalid"] })}
		{error && <p id={`${id}-error`} role="alert" className="text-danger text-xs">{error}</p>}
	</div>;
}
