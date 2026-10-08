import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
  hideChevron?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, hideChevron = false, children, disabled, ...props }, ref) => {
    return (
      <div className={cn('relative inline-flex items-center w-full', wrapperClassName)}>
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-xs transition-colors cursor-pointer',
            hideChevron ? '' : 'appearance-none pr-8',
            'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {!hideChevron && (
          <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
