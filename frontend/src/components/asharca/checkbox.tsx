'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn, focusRing } from './utils';

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  wrapperClassName?: string;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, wrapperClassName, className, id: suppliedId, ...props }, ref,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!, []);
  useEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  const describedBy = [props['aria-describedby'], description && `${id}-description`].filter(Boolean).join(' ') || undefined;
  return (
    <label htmlFor={id} className={cn('grid cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50', wrapperClassName)}>
      <span className="relative mt-0.5 inline-grid size-[1.125rem] place-items-center">
        <input {...props} id={id} ref={input} type="checkbox" aria-describedby={describedBy}
          className={cn('peer m-0 size-[1.125rem] appearance-none rounded-[5px] border border-border bg-background checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary motion-safe:transition-colors', focusRing, className)} />
        <Check aria-hidden="true" className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0" strokeWidth={3} />
        <Minus aria-hidden="true" className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-indeterminate:opacity-100" strokeWidth={3} />
      </span>
      <span className="min-w-0 leading-6"><span className="font-medium">{label}</span>{description && <span id={`${id}-description`} className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>}</span>
    </label>
  );
});
