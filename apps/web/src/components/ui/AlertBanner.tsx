import React, { type ReactNode, type ElementType } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertBannerVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertBannerProps {
  variant?: AlertBannerVariant;
  title?: ReactNode;
  message?: ReactNode;
  children?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: ElementType | ReactNode;
  className?: string;
}

const variantStyles: Record<
  AlertBannerVariant,
  {
    container: string;
    iconColor: string;
    defaultIcon: ElementType;
    dismissHover: string;
  }
> = {
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    iconColor: 'text-emerald-600',
    defaultIcon: CheckCircle2,
    dismissHover: 'text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100/50',
  },
  error: {
    container: 'bg-rose-50 border-rose-200 text-rose-800',
    iconColor: 'text-rose-600',
    defaultIcon: AlertCircle,
    dismissHover: 'text-rose-600 hover:text-rose-900 hover:bg-rose-100/50',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    iconColor: 'text-amber-600',
    defaultIcon: AlertTriangle,
    dismissHover: 'text-amber-600 hover:text-amber-900 hover:bg-amber-100/50',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    iconColor: 'text-blue-600',
    defaultIcon: Info,
    dismissHover: 'text-blue-600 hover:text-blue-900 hover:bg-blue-100/50',
  },
};

export function AlertBanner({
  variant = 'info',
  title,
  message,
  children,
  dismissible = false,
  onDismiss,
  icon,
  className,
}: AlertBannerProps) {
  const currentConfig = variantStyles[variant];
  const DefaultIcon = currentConfig.defaultIcon;

  const renderIcon = () => {
    if (icon) {
      if (React.isValidElement(icon)) return icon;
      const CustomIcon = icon as ElementType;
      return <CustomIcon className={cn('w-4 h-4 shrink-0', currentConfig.iconColor)} />;
    }
    return <DefaultIcon className={cn('w-4 h-4 shrink-0', currentConfig.iconColor)} />;
  };

  const content = message ?? children;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start justify-between gap-3 p-3 rounded-lg border text-xs shadow-xs transition-all duration-200',
        currentConfig.container,
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="mt-0.5 shrink-0">{renderIcon()}</div>
        <div className="min-w-0 flex-1 space-y-0.5">
          {title && <div className="font-semibold text-slate-900">{title}</div>}
          {content && <div className="font-medium leading-relaxed">{content}</div>}
        </div>
      </div>

      {(dismissible || onDismiss) && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className={cn(
            'p-1 rounded-md transition-colors shrink-0 -mr-1 -mt-1',
            currentConfig.dismissHover
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
