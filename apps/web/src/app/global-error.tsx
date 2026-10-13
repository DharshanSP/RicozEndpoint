'use client';

import { RouteErrorView } from '@/components/ErrorBoundary';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <RouteErrorView error={error} reset={reset} />
      </body>
    </html>
  );
}
