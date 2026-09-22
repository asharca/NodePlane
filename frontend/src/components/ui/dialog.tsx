import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
	return <DialogPrimitive.Portal>
		<DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[3px] motion-safe:transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
		<DialogPrimitive.Popup {...props} className={cn("fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-popover p-5 text-popover-foreground outline-none pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[min(88dvh,850px)] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border sm:p-6 sm:shadow-[var(--shadow-dialog)] motion-safe:transition-[opacity,transform] motion-safe:duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0", className)}>
			{children}<DialogPrimitive.Close aria-label="Close dialog" className="absolute top-3 right-3 grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><XIcon className="size-4" /></DialogPrimitive.Close>
		</DialogPrimitive.Popup>
	</DialogPrimitive.Portal>;
}
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) { return <DialogPrimitive.Title {...props} className={cn("pr-9 text-base font-semibold tracking-tight", className)} />; }
function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) { return <DialogPrimitive.Description {...props} className={cn("mt-2 text-sm leading-6 text-muted-foreground", className)} />; }
function DialogFooter({ className, ...props }: ComponentProps<"div">) { return <div {...props} className={cn("mt-6 flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4", className)} />; }
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger };
