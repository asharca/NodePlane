'use client';

import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './button';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  label: string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, loading, ...props }, ref,
) {
  return (
    <Button variant="ghost" {...props} ref={ref} size="icon" loading={loading} aria-label={label} title={props.title ?? label}>
      {!loading && <span aria-hidden="true" className="inline-flex [&_svg]:size-4">{icon}</span>}
    </Button>
  );
});
