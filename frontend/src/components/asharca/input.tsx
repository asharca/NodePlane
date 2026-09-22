'use client';

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn, focusRing } from './utils';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, id: suppliedId, className, wrapperClassName, ...props }, ref,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const describedBy = [props['aria-describedby'], description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid w-full gap-2 text-sm', wrapperClassName)}>
      <label htmlFor={id} className="font-medium leading-5">{label}</label>
      <input {...props} ref={ref} id={id} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}
        className={cn('h-10 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-foreground placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive motion-safe:transition-colors', focusRing, className)} />
      {description && <p id={`${id}-description`} className="text-xs leading-5 text-muted-foreground">{description}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
    </div>
  );
});
