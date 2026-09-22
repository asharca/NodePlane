'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from './button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  text: string;
  label?: string;
  iconOnly?: boolean;
  onCopyResult?: (success: boolean) => void;
}
export function CopyButton({ text, label = '复制', iconOnly = false, onCopyResult, ...props }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    let success = false;
    try { await navigator.clipboard.writeText(text); success = true; } catch { /* Do not claim success when browser access fails. */ }
    setState(success ? 'copied' : 'error');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2200);
    onCopyResult?.(success);
  }
  const caption = state === 'copied' ? '已复制' : state === 'error' ? '复制失败' : label;
  return <span className="inline-flex items-center gap-2"><Button variant="outline" size={iconOnly ? 'icon' : 'sm'} {...props} aria-label={caption} onClick={() => void copy()}>
    {state === 'copied' ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}{!iconOnly && caption}
  </Button><span role="status" className="sr-only">{state === 'idle' ? '' : caption}</span></span>;
}
