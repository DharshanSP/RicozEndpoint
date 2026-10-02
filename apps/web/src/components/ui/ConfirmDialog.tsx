import React, { useState, useEffect, useRef, useId, type ElementType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
  confirmDisabled?: boolean;
  requireCheckbox?: boolean;
  checkboxLabel?: string;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
  icon?: ElementType | ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  confirmDisabled = false,
  requireCheckbox = false,
  checkboxLabel = 'I understand the consequences of this action and wish to proceed.',
  onConfirm,
  children,
  icon,
}: ConfirmDialogProps) {
  const [isChecked, setIsChecked] = useState(false);
  const checkboxId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Focus management: track previously focused element and focus Cancel button on open, restore on close
  useEffect(() => {
    if (open) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        previouslyFocusedElementRef.current?.focus();
      };
    }
  }, [open]);

  // Reset checkbox state whenever the dialog is opened or closed
  useEffect(() => {
    if (open) {
      setIsChecked(false);
    }
  }, [open]);

  // Lock body scroll when dialog is active
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Escape key closes modal (unless currently executing a loading mutation)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onOpenChange]);

  if (!open) return null;

  const isConfirmDisabled = loading || confirmDisabled || (requireCheckbox && !isChecked);

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;
    await onConfirm();
  };

  const renderIcon = () => {
    if (icon) {
      if (React.isValidElement(icon)) {
        return icon;
      }
      const CustomIcon = icon as ElementType;
      return <CustomIcon className="w-5 h-5" />;
    }

    if (variant === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }

    return <AlertOctagon className="w-5 h-5 text-rose-600" />;
  };

  const dialogContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${checkboxId}-title`}
      aria-describedby={`${checkboxId}-desc`}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Content Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Variant Icon */}
            <div
              className={cn(
                'p-2.5 rounded-lg border shrink-0',
                variant === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-rose-50 border-rose-200 text-rose-600',
              )}
            >
              {renderIcon()}
            </div>

            {/* Title & Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 id={`${checkboxId}-title`} className="text-base font-semibold text-slate-900 leading-6">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="text-slate-400 hover:text-slate-600 p-1 -mr-2 -mt-1 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  title="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div id={`${checkboxId}-desc`} className="mt-2 text-xs text-slate-600 leading-relaxed">
                {description}
              </div>
            </div>
          </div>

          {/* Optional custom children */}
          {children && <div className="mt-4 pt-3 border-t border-slate-100">{children}</div>}

          {/* Confirmation Checkbox */}
          {requireCheckbox && (
            <div className="mt-5 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label
                htmlFor={checkboxId}
                className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-700 leading-snug"
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-50 cursor-pointer"
                />
                <span className="font-medium">{checkboxLabel}</span>
              </label>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={loading}
            className="text-xs font-medium border-slate-200 text-slate-700 hover:bg-white hover:text-slate-900"
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn(
              'text-xs font-medium shadow-xs',
              variant === 'warning'
                ? 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500 disabled:bg-amber-300'
                : 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 disabled:bg-rose-300',
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialogContent, document.body) : null;
}
