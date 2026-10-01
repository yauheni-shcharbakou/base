import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it('counts in decimal units, with at most one decimal', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(999)).toBe('999 B');
    expect(formatFileSize(1000)).toBe('1 kB');
    expect(formatFileSize(1024)).toBe('1 kB');
    expect(formatFileSize(1500)).toBe('1.5 kB');
    expect(formatFileSize(1_234_567)).toBe('1.2 MB');
    expect(formatFileSize(100_000_000)).toBe('100 MB');
    expect(formatFileSize(2_000_000_000)).toBe('2 GB');
    expect(formatFileSize(4_500_000_000_000)).toBe('4.5 TB');
  });

  it('moves to the next unit when rounding reaches it', () => {
    expect(formatFileSize(999_950)).toBe('1 MB');
    expect(formatFileSize(999_949)).toBe('999.9 kB');
  });

  it('shows a dash for no size', () => {
    expect(formatFileSize(undefined)).toBe('—');
    expect(formatFileSize(null)).toBe('—');
  });
});
