import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
  maxPageButtons?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = 'items',
  className,
  maxPageButtons = 5,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  // Compute page numbers to display
  const getPageNumbers = () => {
    const half = Math.floor(maxPageButtons / 2);
    let start = Math.max(1, safeCurrentPage - half);
    let end = Math.min(safeTotalPages, start + maxPageButtons - 1);

    if (end - start + 1 < maxPageButtons) {
      start = Math.max(1, end - maxPageButtons + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pages = getPageNumbers();

  const renderRangeText = () => {
    if (totalItems === undefined) {
      return (
        <div className="text-slate-500 text-xs">
          Page <span className="font-semibold text-slate-800">{safeCurrentPage}</span> of{' '}
          <span className="font-semibold text-slate-800">{safeTotalPages}</span>
        </div>
      );
    }

    if (totalItems === 0) {
      return (
        <div className="text-slate-500 text-xs">
          Showing <span className="font-semibold text-slate-800">0</span> {itemLabel}
        </div>
      );
    }

    const effectivePageSize = pageSize || 10;
    const start = (safeCurrentPage - 1) * effectivePageSize + 1;
    const end = Math.min(safeCurrentPage * effectivePageSize, totalItems);

    return (
      <div className="text-slate-500 text-xs">
        Showing <span className="font-semibold text-slate-800">{start}</span>–
        <span className="font-semibold text-slate-800">{end}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'p-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs',
        className
      )}
    >
      {/* Range / Summary Counter */}
      {renderRangeText()}

      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        {/* Optional Page Size Selector */}
        {pageSize !== undefined && onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mr-2">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Previous Button */}
        <Button
          variant="outline"
          size="xs"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Previous page"
          className="gap-0.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pages.map((pNum) => (
            <button
              key={pNum}
              type="button"
              onClick={() => onPageChange(pNum)}
              aria-current={safeCurrentPage === pNum ? 'page' : undefined}
              className={cn(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                safeCurrentPage === pNum
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs'
              )}
            >
              {pNum}
            </button>
          ))}
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="xs"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
          aria-label="Next page"
          className="gap-0.5"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
