'use client';

import { forwardRef, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { LoaderCircle } from 'lucide-react';
import { cn, focusRing, pressSpring } from './utils';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}
const variants = {
  default: 'border-transparent bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border-transparent bg-muted text-foreground hover:bg-muted/75',
  outline: 'border-border bg-background text-foreground hover:bg-muted',
  ghost: 'border-transparent bg-transparent text-foreground hover:bg-muted',
  danger: 'border-transparent bg-destructive text-white hover:opacity-90',
};
const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm', icon: 'size-9 p-0' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', loading = false, disabled, type = 'button', className, children, ...props }, ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.97 }} transition={pressSpring}
      className={cn('inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border font-medium motion-safe:transition-[color,background-color,border-color,opacity] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0', focusRing, variants[variant], sizes[size], className)}
    >
      {loading && <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />}
      {children}
    </motion.button>
  );
});
