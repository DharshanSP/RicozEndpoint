import type { FC } from 'react';
import { Shield, Loader2 } from 'lucide-react';

interface LoadingPageProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
  className?: string;
}

export const LoadingPage: FC<LoadingPageProps> = ({
  message = 'Loading RicozEndpoint...',
  subtext = 'Please wait while we initialize services',
  fullScreen = true,
  className = '',
}) => {
  return (
    <div
      data-testid="global-loading-page"
      className={`${
        fullScreen ? 'min-h-screen' : 'min-h-[360px] h-full'
      } bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 ${className}`}
    >
      <div className="relative flex items-center justify-center mb-5">
        {/* Pulsing background aura */}
        <div className="absolute w-20 h-20 rounded-2xl bg-blue-100/70 animate-ping opacity-30" />

        {/* Outer border container */}
        <div className="relative p-4 rounded-2xl bg-white border border-slate-200/80 shadow-md shadow-slate-200/50 flex items-center justify-center">
          <Shield className="w-10 h-10 text-blue-600" />
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs border border-slate-100">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>

      <div className="text-center space-y-1.5 max-w-sm">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{message}</h3>
        {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
      </div>

      <div className="mt-6 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};
