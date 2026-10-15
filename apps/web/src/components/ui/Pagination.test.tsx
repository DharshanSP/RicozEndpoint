import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '@/components/ui/Pagination';

afterEach(cleanup);

describe('Pagination', () => {
  it('shows range text and handles navigation', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Pagination
        currentPage={2}
        totalPages={4}
        totalItems={42}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('clamps current page and renders page zero state', () => {
    render(
      <Pagination
        currentPage={99}
        totalPages={3}
        totalItems={0}
        itemLabel="rows"
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText((_, element) => (element?.textContent?.replace(/\s+/g, ' ').trim()) === 'Showing 0 rows')
    ).toBeInTheDocument();
  });
});

