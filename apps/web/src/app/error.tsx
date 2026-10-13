'use client';

import { RouteErrorView } from '@/components/ErrorBoundary';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorView error={error} reset={reset} />;
}
