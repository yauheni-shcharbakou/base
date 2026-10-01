import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  getCurrentPdfPage,
  getPdfPageWidth,
  PDF_FIT_ZOOM,
  PDF_ZOOM_STEPS,
  PdfControls,
  stepPdfZoom,
} from '@/features/storage/helpers';
import FitScreenOutlined from '@mui/icons-material/FitScreenOutlined';
import ZoomInRounded from '@mui/icons-material/ZoomInRounded';
import ZoomOutRounded from '@mui/icons-material/ZoomOutRounded';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import React, {
  FC,
  MouseEvent,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// One request for the whole file. The `open` route signs the URL on every call and redirects to
// it, and pdf.js sends its range requests to the URL it was given — each would be another gateway
// call against the per-user rate limit. The asset URLs are the files `assets:pdfjs` copies out of
// `pdfjs-dist` into `public/`: CMaps for CJK text, the 14 standard fonts, ICC profiles for CMYK, and
// the wasm decoders for JPEG 2000 and JBIG2 images. A module constant: a new object reloads the
// document.
const DOCUMENT_OPTIONS = {
  disableRange: true,
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  iccUrl: '/pdfjs/iccs/',
  wasmUrl: '/pdfjs/wasm/',
};

// How far ↑/↓ scroll, and how much of the stage PgUp/PgDn keep in sight.
const LINE_STEP_PX = 64;
const PAGE_STEP_SHARE = 0.9;
// A page renders once it comes within this much of the stage, and is dropped beyond it: a long
// document keeps a few canvases, not one per page.
const RENDER_MARGIN = '150% 0px';
const VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];
// A4, until the first page says otherwise.
const DEFAULT_PAGE_RATIO = Math.SQRT2;

export type PdfFailure = 'protected' | 'error';

type Props = {
  url: string;
  isViewer: boolean;
  controlsRef?: RefObject<PdfControls | null>;
  onLoad: () => void;
  onFailure: (failure: PdfFailure) => void;
};

const ToolbarButton: FC<{
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}> = ({ title, disabled, onClick, children }) => (
  <Tooltip title={title}>
    <span>
      <IconButton
        aria-label={title}
        size="small"
        color="inherit"
        disabled={disabled}
        onClick={onClick}
        // The focus stays with the page, whose keys are the gallery's.
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        sx={{ '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.3)' } }}
      >
        {children}
      </IconButton>
    </span>
  </Tooltip>
);

/**
 * A PDF on a gallery stage, rendered by pdf.js: its pages in one scrolling column, each drawn only
 * while near the stage, with the page the reader is on and the zoom over the bottom. Loaded whole
 * through the `open` route, in one request. The gallery's keys scroll it through `controlsRef`.
 */
export const PdfDocumentView: FC<Props> = ({ url, isViewer, controlsRef, onLoad, onFailure }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState<number>(PDF_FIT_ZOOM);
  // Height over width, per page, as each page loads; the first stands in for the rest until then.
  const [ratios, setRatios] = useState<ReadonlyMap<number, number>>(new Map());
  const [nearPages, setNearPages] = useState<ReadonlySet<number>>(new Set([1]));
  const [visibility, setVisibility] = useState<ReadonlyMap<number, number>>(new Map());
  const slots = useRef(new Map<number, HTMLElement>());
  // One ref callback per page for good: a new one each render would unobserve and observe every
  // page again, and each observe reports at once — a render loop.
  const slotRefs = useRef(new Map<number, (element: HTMLElement | null) => void>());
  const renderObserver = useRef<IntersectionObserver>(null);
  const visibilityObserver = useRef<IntersectionObserver>(null);
  // Where the reader was, as a share of the column, when the zoom changed.
  const pendingScroll = useRef<number>(undefined);

  const pageWidth = getPdfPageWidth(containerWidth, zoom);
  const currentPage = getCurrentPdfPage(visibility, 1);
  const fallbackRatio = ratios.get(1) ?? DEFAULT_PAGE_RATIO;

  useLayoutEffect(() => {
    const element = scroller.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = scroller.current;

    if (!root) {
      return;
    }

    const toPage = (entry: IntersectionObserverEntry) =>
      Number((entry.target as HTMLElement).dataset.page);

    renderObserver.current = new IntersectionObserver(
      (entries) =>
        setNearPages((previous) => {
          const next = new Set(previous);
          entries.forEach((entry) =>
            entry.isIntersecting ? next.add(toPage(entry)) : next.delete(toPage(entry)),
          );
          return next;
        }),
      { root, rootMargin: RENDER_MARGIN },
    );
    visibilityObserver.current = new IntersectionObserver(
      (entries) =>
        setVisibility((previous) => {
          const next = new Map(previous);
          entries.forEach((entry) => next.set(toPage(entry), entry.intersectionRatio));
          return next;
        }),
      { root, threshold: VISIBILITY_THRESHOLDS },
    );

    slots.current.forEach((slot) => {
      renderObserver.current?.observe(slot);
      visibilityObserver.current?.observe(slot);
    });

    return () => {
      renderObserver.current?.disconnect();
      visibilityObserver.current?.disconnect();
      renderObserver.current = null;
      visibilityObserver.current = null;
    };
  }, []);

  const registerSlot = useCallback((page: number, element: HTMLElement | null) => {
    const previous = slots.current.get(page);

    if (previous && previous !== element) {
      renderObserver.current?.unobserve(previous);
      visibilityObserver.current?.unobserve(previous);
      slots.current.delete(page);
    }

    if (element && previous !== element) {
      slots.current.set(page, element);
      renderObserver.current?.observe(element);
      visibilityObserver.current?.observe(element);
    }
  }, []);

  const getSlotRef = (page: number) => {
    let ref = slotRefs.current.get(page);

    if (!ref) {
      ref = (element: HTMLElement | null) => registerSlot(page, element);
      slotRefs.current.set(page, ref);
    }

    return ref;
  };

  useEffect(() => {
    if (!controlsRef) {
      return;
    }

    controlsRef.current = {
      scrollBy: (direction, unit) => {
        const element = scroller.current;

        if (!element) {
          return;
        }

        const distance =
          unit === 'line' ? LINE_STEP_PX : Math.round(element.clientHeight * PAGE_STEP_SHARE);
        element.scrollBy({
          top: direction * distance,
          behavior: unit === 'page' ? 'smooth' : 'auto',
        });
      },
    };

    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);

  // A new zoom keeps the reader where they were, as a share of the column.
  useLayoutEffect(() => {
    const element = scroller.current;
    const share = pendingScroll.current;

    if (!element || share === undefined) {
      return;
    }

    pendingScroll.current = undefined;
    element.scrollTop = share * element.scrollHeight;
  }, [pageWidth]);

  const changeZoom = (next: number) => {
    const element = scroller.current;

    if (next === zoom) {
      return;
    }

    if (element && element.scrollHeight) {
      pendingScroll.current = element.scrollTop / element.scrollHeight;
    }

    setZoom(next);
  };

  // A double click on a page selects a word; only one on the space around the pages opens the
  // viewer.
  const handleDoubleClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('.react-pdf__Page')) {
      event.stopPropagation();
    }
  };

  const minZoom = PDF_ZOOM_STEPS[0];
  const maxZoom = PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1];

  return (
    <Box sx={{ position: 'absolute', inset: 0, visibility: numPages ? 'visible' : 'hidden' }}>
      <Box
        ref={scroller}
        onDoubleClick={handleDoubleClick}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          // Clear of the gallery's bar above and the toolbar below.
          pt: 8,
          pb: 9,
          bgcolor: isViewer ? 'common.black' : 'grey.200',
        }}
      >
        <Document
          file={url}
          options={DOCUMENT_OPTIONS}
          externalLinkTarget="_blank"
          loading={null}
          error={null}
          noData={null}
          onLoadSuccess={(pdf) => {
            setNumPages(pdf.numPages);
            onLoad();
          }}
          onLoadError={() => onFailure('error')}
          onSourceError={() => onFailure('error')}
          // Never the browser's prompt: a protected PDF opens in a new tab, where the browser asks.
          onPassword={() => onFailure('protected')}
        >
          {pageWidth > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                // Wider than the stage when zoomed in, and scrolled to either side from there.
                width: 'max-content',
                minWidth: '100%',
              }}
            >
              {Array.from({ length: numPages }, (_, index) => index + 1).map((page) => (
                <Box
                  key={page}
                  data-page={page}
                  ref={getSlotRef(page)}
                  sx={{
                    width: pageWidth,
                    height: Math.round(pageWidth * (ratios.get(page) ?? fallbackRatio)),
                    bgcolor: 'common.white',
                    boxShadow: 2,
                    overflow: 'hidden',
                  }}
                >
                  {nearPages.has(page) && (
                    <Page
                      pageNumber={page}
                      width={pageWidth}
                      loading={null}
                      onLoadSuccess={({ originalWidth, originalHeight }) =>
                        setRatios((previous) =>
                          previous.get(page) === originalHeight / originalWidth
                            ? previous
                            : new Map(previous).set(page, originalHeight / originalWidth),
                        )
                      }
                    />
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Document>
      </Box>

      {numPages > 0 && (
        <Stack
          direction="row"
          alignItems="center"
          gap={0.5}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            zIndex: 2,
            transform: 'translateX(-50%)',
            px: 1.5,
            py: 0.25,
            borderRadius: 5,
            color: 'common.white',
            bgcolor: 'rgba(0, 0, 0, 0.7)',
          }}
        >
          <Typography variant="body2" sx={{ px: 1, whiteSpace: 'nowrap' }}>
            Page {currentPage} / {numPages}
          </Typography>
          <ToolbarButton
            title="Zoom out"
            disabled={zoom <= minZoom}
            onClick={() => changeZoom(stepPdfZoom(zoom, 'out'))}
          >
            <ZoomOutRounded fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Fit to width"
            disabled={zoom === PDF_FIT_ZOOM}
            onClick={() => changeZoom(PDF_FIT_ZOOM)}
          >
            <FitScreenOutlined fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Zoom in"
            disabled={zoom >= maxZoom}
            onClick={() => changeZoom(stepPdfZoom(zoom, 'in'))}
          >
            <ZoomInRounded fontSize="small" />
          </ToolbarButton>
        </Stack>
      )}
    </Box>
  );
};
