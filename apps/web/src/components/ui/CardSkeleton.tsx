import { cn } from '@/lib/utils';

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 1, className }: CardSkeletonProps) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 animate-pulse',
            className
          )}
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="w-6 h-6 rounded-md bg-slate-100" />
          </div>
          <div className="h-6 w-16 bg-slate-200 rounded" />
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="h-2.5 w-20 bg-slate-100 rounded" />
            <div className="h-2.5 w-16 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
