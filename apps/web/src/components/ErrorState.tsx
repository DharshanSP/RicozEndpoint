import type { FC, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export interface ErrorStateProps {
  title?: string;
  message?: string | ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  className?: string;
  compact?: boolean;
}

export const ErrorState: FC<ErrorStateProps> = ({
  title = 'Unable to load data',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  retryLabel = 'Retry',
  isRetrying = false,
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        data-testid="error-state-compact"
        className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="truncate">{message}</span>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-7 text-xs px-2.5 bg-white border-red-200 text-red-700 hover:bg-red-50 shrink-0 gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{retryLabel}</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="error-state"
      className={`p-8 rounded-xl bg-white border border-red-200 text-center space-y-3.5 shadow-xs ${className}`}
    >
      <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 border border-red-200 shadow-xs">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {typeof message === 'string' ? (
          <p className="text-xs text-slate-600 max-w-md mx-auto">{message}</p>
        ) : (
          message
        )}
      </div>
      {onRetry && (
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{retryLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
};
