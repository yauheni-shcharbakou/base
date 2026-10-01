import {
  getCurrentPdfPage,
  getPdfPageWidth,
  PDF_AUTOLOAD_MAX_BYTES,
  PDF_FIT_MAX_WIDTH,
  PDF_PAGE_GUTTER,
  shouldAutoloadPdf,
  stepPdfZoom,
} from './pdf-view';

describe('shouldAutoloadPdf', () => {
  it('loads a light PDF inline and any PDF in the viewer', () => {
    expect(shouldAutoloadPdf(PDF_AUTOLOAD_MAX_BYTES, false)).toBe(true);
    expect(shouldAutoloadPdf(PDF_AUTOLOAD_MAX_BYTES + 1, false)).toBe(false);
    expect(shouldAutoloadPdf(PDF_AUTOLOAD_MAX_BYTES + 1, true)).toBe(true);
    expect(shouldAutoloadPdf(undefined, false)).toBe(true);
  });
});

describe('getPdfPageWidth', () => {
  it('fits the stage less its gutters', () => {
    expect(getPdfPageWidth(600, 1)).toBe(600 - 2 * PDF_PAGE_GUTTER);
  });

  it('never fits wider than the cap', () => {
    expect(getPdfPageWidth(4000, 1)).toBe(PDF_FIT_MAX_WIDTH);
    expect(getPdfPageWidth(4000, 2)).toBe(2 * PDF_FIT_MAX_WIDTH);
  });

  it('is never negative', () => {
    expect(getPdfPageWidth(0, 1)).toBe(0);
  });
});

describe('stepPdfZoom', () => {
  it('moves to the neighbouring step', () => {
    expect(stepPdfZoom(1, 'in')).toBe(1.25);
    expect(stepPdfZoom(1, 'out')).toBe(0.75);
  });

  it('stays at the ends', () => {
    expect(stepPdfZoom(3, 'in')).toBe(3);
    expect(stepPdfZoom(0.5, 'out')).toBe(0.5);
  });
});

describe('getCurrentPdfPage', () => {
  it('picks the page that shows the most', () => {
    expect(
      getCurrentPdfPage(
        new Map([
          [1, 0.2],
          [2, 0.8],
        ]),
        1,
      ),
    ).toBe(2);
  });

  it('prefers the earlier page on a tie', () => {
    expect(
      getCurrentPdfPage(
        new Map([
          [3, 0.5],
          [2, 0.5],
        ]),
        1,
      ),
    ).toBe(2);
  });

  it('keeps the fallback while nothing shows', () => {
    expect(getCurrentPdfPage(new Map(), 4)).toBe(4);
    expect(getCurrentPdfPage(new Map([[2, 0]]), 4)).toBe(4);
  });
});
