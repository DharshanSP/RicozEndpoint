import React, { type ReactNode, type ElementType } from 'react';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ElementType | ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const renderIcon = () => {
    if (icon) {
      if (React.isValidElement(icon)) return icon;
      const CustomIcon = icon as ElementType;
      return <CustomIcon className="w-6 h-6" />;
    }
    return <PackageOpen className="w-6 h-6" />;
  };

  return (
    <div
      data-testid="empty-state"
      className={cn(
        'rounded-xl border border-slate-200 bg-white text-center shadow-xs space-y-3',
        compact ? 'p-6' : 'p-8 sm:p-12',
        className
      )}
    >
      <div className="inline-flex p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shadow-xs">
        {renderIcon()}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">{description}</p>
        )}
      </div>

      {action && <div className="pt-2 flex items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
