'use client';

import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { Tooltip as Primitive } from 'radix-ui';

export interface TooltipProps {
  children: ReactElement;
  content: ReactNode;
  side?: ComponentPropsWithoutRef<typeof Primitive.Content>['side'];
  delayDuration?: number;
}
export function Tooltip({ children, content, side = 'top', delayDuration = 250 }: TooltipProps) {
  return <Primitive.Provider delayDuration={delayDuration}><Primitive.Root>
    <Primitive.Trigger asChild>{children}</Primitive.Trigger>
    <Primitive.Portal><Primitive.Content side={side} sideOffset={8} collisionPadding={12} className="z-[60] max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-md">
      {content}<Primitive.Arrow className="fill-popover" />
    </Primitive.Content></Primitive.Portal>
  </Primitive.Root></Primitive.Provider>;
}
