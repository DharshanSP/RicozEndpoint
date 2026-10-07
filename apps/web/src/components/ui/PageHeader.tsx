import React, { type ReactNode, type ElementType } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ElementType | ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon,
  badge,
  actions,
  className,
  children,
}: PageHeaderProps) {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const CustomIcon = icon as ElementType;
    return (
      <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
        <CustomIcon className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {renderIcon()}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight truncate">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">{description}</p>
          )}
          {children}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
