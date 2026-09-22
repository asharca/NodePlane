import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './utils';

export function Field({ className, ...props }: ComponentPropsWithoutRef<'div'>) { return <div {...props} className={cn('grid w-full gap-2 text-sm', className)} />; }
export function FieldLabel({ className, ...props }: ComponentPropsWithoutRef<'label'>) { return <label {...props} className={cn('font-medium leading-5', className)} />; }
export function FieldDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) { return <p {...props} className={cn('text-xs leading-5 text-muted-foreground', className)} />; }
export function FieldError({ className, ...props }: ComponentPropsWithoutRef<'p'>) { return <p role="alert" {...props} className={cn('text-xs leading-5 text-destructive', className)} />; }
