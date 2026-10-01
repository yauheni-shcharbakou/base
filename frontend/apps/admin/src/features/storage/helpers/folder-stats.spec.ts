import { formatFolderCounts, formatFolderStats } from './folder-stats';

const stats = (fileCount: number, folderCount: number, totalSize = 0) => ({
  fileCount,
  folderCount,
  totalSize,
});

describe('formatFolderCounts', () => {
  it('counts files and folders, leaving out a zero', () => {
    expect(formatFolderCounts(stats(12, 3))).toBe('12 files, 3 folders');
    expect(formatFolderCounts(stats(1, 1))).toBe('1 file, 1 folder');
    expect(formatFolderCounts(stats(2, 0))).toBe('2 files');
    expect(formatFolderCounts(stats(0, 4))).toBe('4 folders');
  });

  it('calls a folder with neither empty', () => {
    expect(formatFolderCounts(stats(0, 0))).toBe('Empty');
  });
});

describe('formatFolderStats', () => {
  it('adds the size when there are files', () => {
    expect(formatFolderStats(stats(12, 3, 34_500_000))).toBe('12 files, 3 folders · 34.5 MB');
  });

  it('shows no size without files', () => {
    expect(formatFolderStats(stats(0, 2))).toBe('2 folders');
    expect(formatFolderStats(stats(0, 0))).toBe('Empty');
  });
});
