'use client';

import {
  getFolderItemOpenUrl,
  getNeighbourId,
  getStorageItemKind,
  GalleryDirection,
  StorageItemKind,
  stepGallery,
} from '@/features/storage/helpers';
import { BunnyPlayerControls } from '@/features/video/components';
import { usePrefetchVideoPlayerUrls } from '@/features/video/hooks';
import { Box, CircularProgress, Stack } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, useEffect, useRef, useState } from 'react';
import { GalleryBar } from './gallery-bar';
import { GalleryInfo } from './gallery-info';
import { GalleryStage } from './gallery-stage';
import { GalleryViewer } from './gallery-viewer';
import { StorageItemThumbnail } from './storage-item-thumbnail';
import { isControl, isTyping, useWindowKeyDown } from './use-window-key-down';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  items: Item[];
  // The page's items are the previous page's while the next one loads.
  isPlaceholderData: boolean;
  selectedId?: string;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  isInfoShown: boolean;
  onInfoShownChange: (isShown: boolean) => void;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
  onPrefetch: (page: number) => void;
  onOpen: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onPreviewError?: () => void;
  getFolderHref?: (id: string) => string;
};

const SEEK_STEP_SECONDS = 10;

const isPlayable = (item: Item) =>
  getStorageItemKind(item) === StorageItemKind.VIDEO && !!getFolderItemOpenUrl(item);

// Where the viewer's video goes on from: the inline player's, as its own full-screen button opened
// the viewer.
type ViewerStart = { id: string; seconds: number };

// A player's own full screen may sit on the viewer's, and each exit leaves one.
const MAX_FULLSCREEN_DEPTH = 2;
// A request some browsers never settle — embedded ones — must not keep the viewer from opening.
const FULLSCREEN_SETTLE_TIMEOUT_MS = 3000;

const exitFullscreen = async () => {
  for (let depth = 0; depth < MAX_FULLSCREEN_DEPTH && document.fullscreenElement; depth += 1) {
    await document.exitFullscreen().catch(() => undefined);
  }
};

/**
 * Finder's gallery view: the selected item large, the page as a strip of small thumbnails below,
 * its details over the stage on demand. The keys are Finder's — ←/→ step (on to the next or
 * previous page at an edge), Home/End jump to the ends of the folder, Enter or ⌘↓ opens, Space
 * toggles the full-screen viewer, I the details, ⌘⌫ or Delete deletes, and K / J / L / M drive a
 * playing video (going up is the folder browser's, in every view). The selection is kept in the URL.
 * A click in the strip only selects: a video plays on a click on its poster, or by itself in the
 * viewer.
 */
export const FolderGalleryView: FC<Props> = ({
  items,
  isPlaceholderData,
  selectedId,
  page,
  pageCount,
  pageSize,
  total,
  isInfoShown,
  onInfoShownChange,
  onSelect,
  onPageChange,
  onPrefetch,
  onOpen,
  onDelete,
  onPreviewError,
  getFolderHref,
}) => {
  const [isViewer, setViewer] = useState(false);
  const [viewerStart, setViewerStart] = useState<ViewerStart>();
  // Whether the viewer holds the browser's full screen: only then does leaving full screen close it.
  // An inline player's full screen coming and going, or a refused request, does not.
  const hasFullscreen = useRef(false);
  // The page a step across an edge went to, and which end of it to select once it is loaded.
  const pendingEdge = useRef<{ page: number; edge: 'first' | 'last' } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const thumbs = useRef(new Map<string, HTMLElement>());
  // The playing video's player, inline or in the viewer — one stage is mounted at a time.
  const playerControls = useRef<BunnyPlayerControls | null>(null);
  // The page as last shown with the selection on it, to find where a deleted item stood.
  const shownItems = useRef(items);

  const index = isPlaceholderData ? -1 : items.findIndex((item) => item.id === selectedId);
  const selected = index >= 0 ? items[index] : undefined;
  const position = { index, count: items.length, page, pageCount };

  // The page's players get their URLs in one call: stepping from video to video spends none.
  usePrefetchVideoPlayerUrls(
    isPlaceholderData
      ? []
      : items.filter((item) => isPlayable(item) && item.videoId).map((item) => item.videoId!),
  );

  // Select on arrival: the end a step came in from; the neighbour of an item just deleted, as Finder
  // does; else the first item when the URL names none on this page.
  useEffect(() => {
    if (isPlaceholderData || !items.length) {
      return;
    }

    const pending = pendingEdge.current;

    if (pending?.page === page) {
      pendingEdge.current = null;
      onSelect(pending.edge === 'first' ? items[0].id : items[items.length - 1].id);
      return;
    }

    // Remembered only while it holds the selection, so a refetch that lands before the new
    // selection does still finds where the deleted item stood.
    if (index >= 0) {
      shownItems.current = items;
      return;
    }

    const neighbourId = selectedId && getNeighbourId(shownItems.current, selectedId);
    const isNeighbourShown = items.some((item) => item.id === neighbourId);

    onSelect(neighbourId && isNeighbourShown ? neighbourId : items[0].id);
  }, [items, isPlaceholderData, index, page, selectedId, onSelect]);

  // Near an end of the strip, the neighbouring page loads ahead, so the step across is instant.
  useEffect(() => {
    if (index < 0) {
      return;
    }

    if (index >= items.length - 3 && page < pageCount) {
      onPrefetch(page + 1);
    }

    if (index <= 2 && page > 1) {
      onPrefetch(page - 1);
    }
  }, [index, items.length, page, pageCount, onPrefetch]);

  // The strip alone scrolls to centre the selection: `scrollIntoView` would scroll the page too.
  useEffect(() => {
    const thumb = selectedId ? thumbs.current.get(selectedId) : undefined;

    if (thumb && strip.current) {
      strip.current.scrollTo({
        left: thumb.offsetLeft - (strip.current.clientWidth - thumb.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [selectedId]);

  // The browser leaves full screen by itself on Esc, which never reaches the page: the viewer goes
  // with it. Leaving the page — into a folder, to another view — leaves full screen too.
  useEffect(() => {
    if (!isViewer) {
      return;
    }

    const handleChange = () => {
      if (!document.fullscreenElement && hasFullscreen.current) {
        hasFullscreen.current = false;
        setViewer(false);
      }
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [isViewer]);

  useEffect(
    () => () => {
      void exitFullscreen();
    },
    [],
  );

  // The whole document, not the viewer: menus, dialogs and notifications open in portals outside it
  // and would stay hidden behind a full-screen viewer. Refused, the viewer still fills the window.
  const requestFullscreen = async () => {
    await document.documentElement.requestFullscreen();
    hasFullscreen.current = true;
  };

  const enterViewer = () => {
    setViewerStart(undefined);
    setViewer(true);
    requestFullscreen().catch(() => undefined);
  };

  // The inline player went full screen by its own button: the viewer takes over and plays on from
  // where it was. The document takes the full screen while the player still holds it — removing
  // the full-screen element, as the viewer replacing the inline player does, leaves full screen
  // altogether — or, refused, once the player has left it; only then does the viewer open.
  const continueInViewer = async (start: ViewerStart) => {
    const outcome = await Promise.race([
      requestFullscreen().then(
        () => 'entered',
        () => 'refused',
      ),
      new Promise((resolve) => setTimeout(resolve, FULLSCREEN_SETTLE_TIMEOUT_MS, 'unsettled')),
    ]);

    if (outcome === 'refused') {
      await exitFullscreen();
      await requestFullscreen().catch(() => undefined);
    }

    setViewerStart(start);
    setViewer(true);
  };

  const exitViewer = () => {
    hasFullscreen.current = false;
    setViewer(false);
    void exitFullscreen();
  };

  const toggleInfo = () => onInfoShownChange(!isInfoShown);

  const step = (direction: GalleryDirection) => {
    const next = stepGallery(position, direction);

    if (!next) {
      return;
    }

    setViewerStart(undefined);

    if ('index' in next) {
      onSelect(items[next.index].id);
      return;
    }

    pendingEdge.current = next;
    onPageChange(next.page);
  };

  useWindowKeyDown((event) => {
    if (event.defaultPrevented || event.altKey || isTyping(event.target)) {
      return;
    }

    const isModified = event.metaKey || event.ctrlKey;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        if (isModified) {
          return;
        }
        step(event.key === 'ArrowRight' ? 'next' : 'prev');
        break;
      case 'Home':
        step('first');
        break;
      case 'End':
        step('last');
        break;
      case 'ArrowDown':
        if (!isModified || !selected) {
          return;
        }
        onOpen(selected);
        break;
      case 'Enter':
        if (isControl(event.target) || !selected) {
          return;
        }
        onOpen(selected);
        break;
      case ' ':
        if (isControl(event.target)) {
          return;
        }
        if (isViewer) {
          exitViewer();
        } else if (selected) {
          enterViewer();
        }
        break;
      case 'i':
      case 'I':
        if (isModified) {
          return;
        }
        toggleInfo();
        break;
      // The player keeps no keys of its own here (it hands the focus back), so these are YouTube's.
      case 'k':
      case 'K':
      case 'j':
      case 'J':
      case 'l':
      case 'L':
      case 'm':
      case 'M': {
        const controls = playerControls.current;

        if (isModified || !controls) {
          return;
        }

        const key = event.key.toLowerCase();

        if (key === 'k') {
          controls.togglePlay();
        } else if (key === 'm') {
          controls.toggleMute();
        } else {
          controls.seekBy(key === 'l' ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS);
        }
        break;
      }
      case 'Delete':
      case 'Backspace':
        // A bare Backspace is the folder browser's: up to the parent.
        if ((event.key === 'Backspace' && !isModified) || !selected || !onDelete) {
          return;
        }
        onDelete(selected);
        break;
      default:
        return;
    }

    event.preventDefault();
  });

  const overall = index >= 0 ? `${(page - 1) * pageSize + index + 1} / ${total}` : undefined;

  return (
    <Stack gap={1.5}>
      <Box
        onDoubleClick={() => selected && enterViewer()}
        sx={{
          position: 'relative',
          height: { xs: 360, md: '72vh' },
          minHeight: 320,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        {/* One stage at a time: a second would load the original or play the video twice. */}
        {!isViewer &&
          (selected ? (
            <GalleryStage
              key={selected.id}
              item={selected}
              onFullscreen={(seconds) => continueInViewer({ id: selected.id, seconds })}
              onOpen={onOpen}
              onPreviewError={onPreviewError}
              playerControls={playerControls}
            />
          ) : (
            <Stack
              sx={{ position: 'absolute', inset: 0 }}
              alignItems="center"
              justifyContent="center"
            >
              <CircularProgress />
            </Stack>
          ))}
        {selected && !isViewer && (
          <GalleryBar
            item={selected}
            position={overall}
            isInfoShown={isInfoShown}
            onToggleInfo={toggleInfo}
            onToggleViewer={() => enterViewer()}
            onOpen={onOpen}
            onDelete={onDelete}
            getFolderHref={getFolderHref}
          />
        )}
        {selected && isInfoShown && !isViewer && <GalleryInfo item={selected} />}
      </Box>

      <Box
        ref={strip}
        sx={{
          position: 'relative',
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          p: 0.5,
          scrollbarWidth: 'thin',
        }}
        aria-label="Items"
      >
        {items.map((item) => {
          const isSelected = item.id === selected?.id;

          return (
            <Box
              key={item.id}
              ref={(element: HTMLElement | null) => {
                if (element) {
                  thumbs.current.set(item.id, element);
                } else {
                  thumbs.current.delete(item.id);
                }
              }}
              title={item.name}
              aria-selected={isSelected}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onOpen(item)}
              sx={{
                flex: '0 0 auto',
                width: 48,
                height: 36,
                borderRadius: 1,
                overflow: 'hidden',
                cursor: 'pointer',
                outline: isSelected ? '2px solid' : '1px solid',
                outlineColor: isSelected ? 'primary.main' : 'divider',
                outlineOffset: isSelected ? 0 : -1,
                opacity: isPlaceholderData ? 0.5 : 1,
              }}
            >
              <StorageItemThumbnail
                item={item}
                iconSize={18}
                compact
                onPreviewError={onPreviewError}
              />
            </Box>
          );
        })}
      </Box>

      <GalleryViewer
        open={isViewer}
        item={selected}
        startTime={viewerStart?.id === selected?.id ? viewerStart?.seconds : undefined}
        position={overall}
        canPrev={!!stepGallery(position, 'prev')}
        canNext={!!stepGallery(position, 'next')}
        isInfoShown={isInfoShown}
        onPrev={() => step('prev')}
        onNext={() => step('next')}
        onExit={exitViewer}
        onToggleInfo={toggleInfo}
        onOpen={onOpen}
        onDelete={onDelete}
        onPreviewError={onPreviewError}
        getFolderHref={getFolderHref}
        playerControls={playerControls}
      />
    </Stack>
  );
};
