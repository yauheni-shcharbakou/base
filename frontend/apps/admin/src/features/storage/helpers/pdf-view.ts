import { ONE_MB_BYTES } from '@/common/constants';

/**
 * The inline gallery loads a PDF on its own up to this size; a heavier one waits for a click. The
 * viewer always loads it: there the PDF is what was asked for. A file may weigh 100 MB, and resting
 * on it in the strip should not download that.
 */
export const PDF_AUTOLOAD_MAX_BYTES = 20 * ONE_MB_BYTES;

// A page at "fit" fills the width of its stage, but never wider than this, as in Drive.
export const PDF_FIT_MAX_WIDTH = 960;
// The space left on either side of a page at "fit".
export const PDF_PAGE_GUTTER = 24;
// Zoom relative to "fit": 1 is the page as wide as the stage allows.
export const PDF_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export const PDF_FIT_ZOOM = 1;

/** What the gallery's keys do to the PDF on its stage. */
export type PdfControls = {
  scrollBy: (direction: 1 | -1, unit: 'line' | 'page') => void;
};

export const shouldAutoloadPdf = (size: number | undefined, isViewer: boolean): boolean =>
  isViewer || (size ?? 0) <= PDF_AUTOLOAD_MAX_BYTES;

export const getPdfPageWidth = (containerWidth: number, zoom: number): number => {
  const fit = Math.min(containerWidth - 2 * PDF_PAGE_GUTTER, PDF_FIT_MAX_WIDTH);
  return Math.max(0, Math.round(fit * zoom));
};

/** The next zoom step in a direction, or the same zoom at the end of the steps. */
export const stepPdfZoom = (zoom: number, direction: 'in' | 'out'): number => {
  if (direction === 'in') {
    return PDF_ZOOM_STEPS.find((step) => step > zoom) ?? zoom;
  }

  return [...PDF_ZOOM_STEPS].reverse().find((step) => step < zoom) ?? zoom;
};

/**
 * The page the reader is on: the one that shows the most of itself, the earlier on a tie; the
 * fallback while none is known to show.
 */
export const getCurrentPdfPage = (
  visibility: ReadonlyMap<number, number>,
  fallback: number,
): number => {
  let current = fallback;
  let best = 0;

  Array.from(visibility.entries()).forEach(([page, ratio]) => {
    if (ratio > best || (ratio === best && ratio > 0 && page < current)) {
      current = page;
      best = ratio;
    }
  });

  return current;
};
