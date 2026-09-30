import { ONE_KB_BYTES } from '@/common/constants';

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB'] as const;

// A fixed locale: the admin is in English, and the server and the browser must render the same text.
const sizeFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/**
 * A size in decimal (SI) units, as Finder, Drive and a disk's label count them: 1 kB is 1000 bytes.
 * At most one decimal, none when it is zero. The unit is picked after rounding, so 999 950 bytes read
 * as "1 MB", never "1,000 kB". No size at all is a dash.
 */
export const formatFileSize = (bytes?: number | null): string => {
  if (bytes === undefined || bytes === null) {
    return '—';
  }

  let value = bytes;
  let unit = 0;

  while (unit < UNITS.length - 1 && Math.round(value * 10) / 10 >= ONE_KB_BYTES) {
    value /= ONE_KB_BYTES;
    unit++;
  }

  return `${sizeFormat.format(value)} ${UNITS[unit]}`;
};
