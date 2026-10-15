import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="No devices"
        description="Try adjusting filters"
        action={<button type="button">Refresh</button>}
      />,
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No devices')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('renders a custom icon element and compact spacing', () => {
    const { container } = render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="custom-icon">★</span>}
        compact
      />,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('p-6');
  });
});

