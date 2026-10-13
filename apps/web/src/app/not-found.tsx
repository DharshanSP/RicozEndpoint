import Link from 'next/link';
import { RouteErrorView } from '@/components/ErrorBoundary';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-6">
      <RouteErrorView
        title="Page Not Found"
        message="The page you are looking for does not exist or has been moved."
        statusText="404 Not Found"
      />
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
