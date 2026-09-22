'use client';
import { forwardRef, useImperativeHandle, useRef, type ComponentPropsWithoutRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './utils';
export interface SearchInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value'> { label: string; value: string; onClear: () => void }
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({ label, value, onClear, className, ...props }, ref) {
  const input = useRef<HTMLInputElement>(null); useImperativeHandle(ref, () => input.current!, []);
  return <div className={cn('flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring/50', className)}><Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    <input {...props} ref={input} value={value} type="search" aria-label={label} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden" />
    {value && <button type="button" aria-label={`清空${label}`} disabled={props.disabled || props.readOnly} className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
      onClick={() => { if (input.current?.matches(':disabled') || input.current?.readOnly) return; onClear(); input.current?.focus(); }}><X aria-hidden="true" className="size-3.5" /></button>}
  </div>;
});
