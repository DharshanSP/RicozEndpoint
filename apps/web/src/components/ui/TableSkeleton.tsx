import { cn } from '@/lib/utils';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden animate-pulse',
        className
      )}
    >
      {showHeader && (
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-4">
          <div className="h-3.5 w-32 bg-slate-200 rounded" />
          <div className="h-3.5 w-24 bg-slate-200 rounded hidden sm:block" />
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-3 w-40 max-w-[80%] bg-slate-200 rounded" />
                <div className="h-2.5 w-24 bg-slate-100 rounded" />
              </div>
            </div>

            {[...Array(Math.max(1, columns - 2))].map((_, j) => (
              <div
                key={j}
                className={cn(
                  'h-3 bg-slate-200 rounded w-20',
                  j > 0 ? 'hidden md:block' : '',
                  j > 1 ? 'hidden lg:block' : ''
                )}
              />
            ))}

            <div className="h-7 w-16 bg-slate-100 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
