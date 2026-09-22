import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './utils';
export interface CardProps extends ComponentPropsWithoutRef<'div'> { muted?: boolean; padded?: boolean }
export function Card({ muted = false, padded = true, className, ...props }: CardProps) { return <div {...props} className={cn('rounded-2xl border border-border bg-background text-foreground', muted && 'bg-muted/30', padded && 'p-5', className)} />; }
export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) { return <div {...props} className={cn('mb-4 flex items-start justify-between gap-3', className)} />; }
export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<'h3'>) { return <h3 {...props} className={cn('text-sm font-semibold tracking-tight', className)} />; }
export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) { return <p {...props} className={cn('mt-1 text-xs leading-6 text-muted-foreground', className)} />; }
export function CardContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) { return <div {...props} className={cn('text-sm', className)} />; }
export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) { return <div {...props} className={cn('mt-5 flex flex-wrap items-center gap-2', className)} />; }
