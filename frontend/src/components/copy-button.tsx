import { CopyButton as AsharcaCopyButton } from "@/components/asharca/copy-button";
import { toast } from "sonner";

export function CopyButton({ text, className }: { text: string; className?: string }) {
	return <AsharcaCopyButton text={text} label="Copy to clipboard" iconOnly className={className}
		onCopyResult={(success) => { if (!success) toast.error("Could not copy to clipboard"); }} />;
}
