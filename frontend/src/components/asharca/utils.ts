import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...values: ClassValue[]) { return twMerge(clsx(values)); }
export const pressSpring = { type: 'spring', stiffness: 460, damping: 32, mass: 0.6 } as const;
export const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
