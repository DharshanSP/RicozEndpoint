'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ModalProps {
  onClose: () => void;
  /** Accessible name for the dialog (required — screen readers announce it). */
  title: string;
  children: ReactNode;
  /** Drawer-style panel anchored to the right edge instead of centered. */
  align?: 'center' | 'end';
  /** Extra classes for the dimmed backdrop layer. */
  overlayClassName?: string;
  /** Extra classes for the panel wrapper around the children. */
  panelClassName?: string;
  /** Blocks Escape / backdrop dismissal while a mutation is in flight. */
  busy?: boolean;
}

/**
 * Accessible dialog shell: portal, `role="dialog"`, Escape to close,
 * backdrop click, body scroll lock, and focus restore on close.
 * Callers keep full control of the panel contents and styling.
 */
export function Modal({
  onClose,
  title,
  children,
  align = 'center',
  overlayClassName,
  panelClassName,
  busy = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusTarget =
      panel?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
      ) ?? panel;
    const timer = setTimeout(() => focusTarget?.focus(), 50);
    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  const handleBackdropClick = () => {
    if (!busy) onClose();
  };

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150',
        align === 'center' ? 'items-center justify-center p-4' : 'justify-end',
        overlayClassName,
      )}
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn('min-h-0 min-w-0 outline-none', panelClassName)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
