'use client';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn, focusRing } from './utils';

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, description, error, id: suppliedId, wrapperClassName, className, rows = 4, ...props }, ref,
) {
  const generated = useId();
  const id = suppliedId ?? generated;
  const describedBy = [props['aria-describedby'], description && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={cn('grid w-full gap-2 text-sm', wrapperClassName)}>
    <label htmlFor={id} className="font-medium">{label}</label>
    <textarea {...props} id={id} ref={ref} rows={rows} aria-describedby={describedBy} aria-invalid={error ? true : props['aria-invalid']}
      className={cn('min-h-24 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 leading-6 text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive', focusRing, className)} />
    {description && <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{description}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
  </div>;
});
