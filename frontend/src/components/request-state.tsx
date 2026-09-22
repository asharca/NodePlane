import { CircleAlert, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/asharca/empty-state";
import { Button } from "@/components/ui/button";
export function RequestError({
	title = "Unable to load this view",
	description = "Your data could not be loaded. Check the connection and try again.",
	onRetry,
	retrying = false,
}: {
	title?: string;
	description?: string;
	onRetry: () => void;
	retrying?: boolean;
}) {
	return (
		<div role="alert" className="p-4 sm:p-6">
			<EmptyState
				icon={<CircleAlert />}
				title={title}
				description={description}
				className="border-danger-line bg-danger-muted/25"
				actions={
					<Button variant="outline" loading={retrying} onClick={onRetry}>
						<RotateCcw className="size-4" />
						Try again
					</Button>
				}
			/>
		</div>
	);
}
