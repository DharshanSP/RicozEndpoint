import { describe, it, expect } from 'vitest';
import { formatBytes, formatDateTime, formatRelativeTime } from './format';

describe('formatDateTime', () => {
  it('renders empty values as an em dash', () => {
    expect(formatDateTime()).toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('passes invalid dates through untouched', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('renders a valid ISO timestamp with date and time parts', () => {
    const out = formatDateTime('2026-10-15T12:30:00.000Z');
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Oct/);
  });
});

describe('formatRelativeTime', () => {
  it('renders empty values as Never', () => {
    expect(formatRelativeTime()).toBe('Never');
    expect(formatRelativeTime(null)).toBe('Never');
  });

  it('passes invalid dates through untouched', () => {
    expect(formatRelativeTime('garbage')).toBe('garbage');
  });

  it('buckets recent timestamps', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 10_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h ago');
    expect(formatRelativeTime(new Date(now - 9 * 86_400_000).toISOString())).toBe('9d ago');
  });
});

describe('formatBytes', () => {
  it('renders non-positive or non-numeric input as an em dash', () => {
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(-5)).toBe('—');
    expect(formatBytes('nope')).toBe('—');
  });

  it('scales through units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});
