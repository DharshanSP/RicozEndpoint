import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // In production, route to observability / monitoring service if configured
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary caught error]:', error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          data-testid="global-error-boundary"
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center space-y-6">
            <div className="inline-flex p-4 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Unexpected Application Error
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                An unhandled exception occurred in the application interface. You can attempt to retry the action or return to the main dashboard.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={this.handleReset}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
              >
                <span>Reload Page</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleGoHome}
                className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Button>
            </div>

            {/* Unobtrusive collapsible technical details */}
            {this.state.error && (
              <div className="pt-4 border-t border-slate-100 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-[11px] font-medium text-slate-400 hover:text-slate-600 py-1"
                >
                  <span>Technical Diagnostics</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-auto max-h-40 space-y-1">
                    <p className="text-red-400 font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">{this.state.error.stack}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Route-level error element fallback for React Router.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const [showDetails, setShowDetails] = useState(false);

  let title = 'Unexpected Application Error';
  let message = 'An unhandled exception occurred in the application interface. You can reload or return to the dashboard.';
  let statusText = '';
  let errorDetails: { name: string; message: string; stack?: string } | null = null;

  if (isRouteErrorResponse(error)) {
    statusText = `${error.status} ${error.statusText}`;
    title = error.status === 404 ? 'Page Not Found' : 'Navigation Error';
    message = error.data?.message || error.statusText || 'The requested page or route could not be loaded.';
  } else if (error instanceof Error) {
    title = 'Unexpected Application Error';
    message = error.message || message;
    errorDetails = { name: error.name, message: error.message, stack: error.stack };
  }

  return (
    <div
      data-testid="route-error-boundary"
      className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center space-y-6">
        <div className="inline-flex p-4 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          {statusText && (
            <span className="inline-block text-[11px] font-bold text-amber-700 uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
              {statusText}
            </span>
          )}
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => window.location.reload()}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = '/')}
            className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Button>
        </div>

        {/* Unobtrusive collapsible technical details */}
        {errorDetails && (
          <div className="pt-4 border-t border-slate-100 text-left">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="flex items-center justify-between w-full text-[11px] font-medium text-slate-400 hover:text-slate-600 py-1"
            >
              <span>Technical Diagnostics</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-auto max-h-40 space-y-1">
                <p className="text-red-400 font-semibold">{errorDetails.name}: {errorDetails.message}</p>
                {errorDetails.stack && (
                  <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">{errorDetails.stack}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
