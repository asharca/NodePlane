'use client';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { DropdownMenu as Primitive } from 'radix-ui';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from './utils';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;
export const DropdownMenuSub = Primitive.Sub;
const surface = 'z-50 min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg';
const itemStyle = 'relative flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-3.5';
export const DropdownMenuContent = forwardRef<ElementRef<typeof Primitive.Content>, ComponentPropsWithoutRef<typeof Primitive.Content>>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return <Primitive.Portal><Primitive.Content {...props} ref={ref} sideOffset={sideOffset} collisionPadding={12} className={cn(surface, className)} /></Primitive.Portal>;
});
export const DropdownMenuItem = forwardRef<ElementRef<typeof Primitive.Item>, ComponentPropsWithoutRef<typeof Primitive.Item> & { danger?: boolean }>(function DropdownMenuItem({ className, danger, ...props }, ref) {
  return <Primitive.Item {...props} ref={ref} className={cn(itemStyle, danger && 'text-destructive', className)} />;
});
export const DropdownMenuCheckboxItem = forwardRef<ElementRef<typeof Primitive.CheckboxItem>, ComponentPropsWithoutRef<typeof Primitive.CheckboxItem>>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return <Primitive.CheckboxItem {...props} ref={ref} className={cn(itemStyle, 'pl-8', className)}><Primitive.ItemIndicator className="absolute left-2.5"><Check /></Primitive.ItemIndicator>{children}</Primitive.CheckboxItem>;
});
export const DropdownMenuRadioItem = forwardRef<ElementRef<typeof Primitive.RadioItem>, ComponentPropsWithoutRef<typeof Primitive.RadioItem>>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return <Primitive.RadioItem {...props} ref={ref} className={cn(itemStyle, 'pl-8', className)}><Primitive.ItemIndicator className="absolute left-3"><span className="block size-1.5 rounded-full bg-current" /></Primitive.ItemIndicator>{children}</Primitive.RadioItem>;
});
export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof Primitive.Label>) { return <Primitive.Label {...props} className={cn('px-2.5 py-2 text-[10px] text-muted-foreground', className)} />; }
export function DropdownMenuSeparator(props: ComponentPropsWithoutRef<typeof Primitive.Separator>) { return <Primitive.Separator {...props} className={cn('my-1 h-px bg-border', props.className)} />; }
export const DropdownMenuSubTrigger = forwardRef<ElementRef<typeof Primitive.SubTrigger>, ComponentPropsWithoutRef<typeof Primitive.SubTrigger>>(function DropdownMenuSubTrigger({ children, className, ...props }, ref) {
  return <Primitive.SubTrigger {...props} ref={ref} className={cn(itemStyle, className)}>{children}<ChevronRight className="ml-auto" /></Primitive.SubTrigger>;
});
export function DropdownMenuSubContent({ className, ...props }: ComponentPropsWithoutRef<typeof Primitive.SubContent>) { return <Primitive.Portal><Primitive.SubContent {...props} className={cn(surface, className)} /></Primitive.Portal>; }
