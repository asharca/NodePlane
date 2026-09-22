'use client';

import { forwardRef, useId, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { Switch as Primitive } from 'radix-ui';
import { cn, focusRing } from './utils';

export interface SwitchProps extends ComponentPropsWithoutRef<typeof Primitive.Root> {
  label: ReactNode;
  description?: ReactNode;
}
export const Switch = forwardRef<ElementRef<typeof Primitive.Root>, SwitchProps>(function Switch(
  { label, description, className, id: suppliedId, disabled, ...props }, ref,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className={cn('flex items-start gap-3 text-sm', disabled && 'opacity-50')}>
      <Primitive.Root {...props} id={id} ref={ref} disabled={disabled}
        aria-describedby={[props['aria-describedby'], description && `${id}-description`].filter(Boolean).join(' ') || undefined}
        className={cn('mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border bg-muted p-[3px] data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed motion-safe:transition-colors', focusRing, className)}>
        <Primitive.Thumb className="block size-4 rounded-full bg-background shadow-sm data-[state=checked]:translate-x-4 motion-safe:transition-transform motion-safe:duration-200" />
      </Primitive.Root>
      <label htmlFor={id} className={cn('min-w-0 cursor-pointer leading-6', disabled && 'cursor-not-allowed')}><span className="font-medium">{label}</span>{description && <span id={`${id}-description`} className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>}</label>
    </div>
  );
});
