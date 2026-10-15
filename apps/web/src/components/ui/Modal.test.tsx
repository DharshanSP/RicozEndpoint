import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

afterEach(cleanup);

describe('Modal', () => {
  it('renders children with dialog role and title', () => {
    render(
      <Modal onClose={vi.fn()} title="Test modal">
        <button>Delete</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Test modal');
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onClose on Escape when not busy', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} title="T">
        <span>x</span>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when busy', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} title="T" busy>
        <span>x</span>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on backdrop click and stops panel click', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} title="T">
        <button type="button">inner</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const panelButton = screen.getByText('inner');
    fireEvent.mouseDown(panelButton);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

