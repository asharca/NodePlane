'use client';

import { forwardRef, useId, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { Select as Primitive } from 'radix-ui';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, focusRing } from './utils';

export interface SelectProps extends Omit<ComponentPropsWithoutRef<typeof Primitive.Root>, 'children'> {
  label: ReactNode;
  items: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  className?: string;
  id?: string;
}
export const Select = forwardRef<ElementRef<typeof Primitive.Trigger>, SelectProps>(function Select(
  { label, items, placeholder = '请选择', className, id: suppliedId, ...props }, ref,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className="grid w-full gap-2 text-sm">
      <label htmlFor={id} className="font-medium">{label}</label>
      <Primitive.Root {...props}>
        <Primitive.Trigger id={id} ref={ref} className={cn('flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', focusRing, className)}>
          <Primitive.Value placeholder={placeholder} /><Primitive.Icon><ChevronDown className="size-4 opacity-60" /></Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content position="popper" sideOffset={6} collisionPadding={12} className="z-50 max-h-[min(var(--radix-select-content-available-height),20rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
            <Primitive.ScrollUpButton className="flex justify-center py-1"><ChevronUp className="size-4" /></Primitive.ScrollUpButton>
            <Primitive.Viewport className="p-1">
              {items.map((item) => <Primitive.Item key={item.value} value={item.value} disabled={item.disabled} className="relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-40">
                <Primitive.ItemIndicator className="absolute left-2"><Check className="size-4" /></Primitive.ItemIndicator><Primitive.ItemText>{item.label}</Primitive.ItemText>
              </Primitive.Item>)}
            </Primitive.Viewport>
            <Primitive.ScrollDownButton className="flex justify-center py-1"><ChevronDown className="size-4" /></Primitive.ScrollDownButton>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </div>
  );
});
