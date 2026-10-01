import {
  GalleryDirection,
  getFolderItemOpenUrl,
  getNeighbourId,
  getOverallPosition,
  getShortcutKey,
  getStorageItemKind,
  PdfControls,
  pickArrival,
  StorageItemKind,
  stepFiles,
  stepGallery,
} from '@/features/storage/helpers';
import { BunnyPlayerControls } from '@/features/video/components';
import { usePrefetchVideoPlayerUrls } from '@/features/video/hooks';
import type { BrowserStorage } from '@packages/proto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isControl, isTyping, useWindowKeyDown } from './use-window-key-down';

type Item = BrowserStorage.StorageObjectFolderItem;

// Where the viewer's video goes on from: the inline player's, as its own full-screen button opened
// the viewer.
export type ViewerStart = { id: string; seconds: number };

// A step across pages waits for the page: to land on its first or last item, or — having found
// nothing to land on — back on the item it started from.
type PendingArrival =
  | { page: number; edge: 'first' | 'last'; from?: { page: number; id: string } }
  | { page: number; id: string };

type Options = {
  items: Item[];
  // The page's items are the previous page's while the next one loads.
  isPlaceholderData: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  // How many of `total` are folders.
  folderTotal: number;
  // The item on show: the gallery's selection, or the viewer's own over the grid and the list.
  currentId?: string;
  onCurrentChange: (id: string) => void;
  onPageChange: (page: number) => void;
  onPrefetch: (page: number) => void;
  // Over the grid and the list, as in Drive: the viewer steps over the files alone, lives only while
  // it is open, and moves on from an item deleted under it. The gallery keeps its own selection
  // there, and its strip.
  isFilesOnly: boolean;
  // Enter in the viewer: the item itself, in a new tab.
  onOpen: (item: Item) => void;
  onRename?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onToggleInfo: () => void;
  // Left, with the item it was on.
  onExit?: (item?: Item) => void;
};

export const SEEK_STEP_SECONDS = 10;
// A player's own full screen may sit on the viewer's, and each exit leaves one.
const MAX_FULLSCREEN_DEPTH = 2;
// A request some browsers never settle — embedded ones — must not keep the viewer from opening.
const FULLSCREEN_SETTLE_TIMEOUT_MS = 3000;

const exitFullscreen = async () => {
  for (let depth = 0; depth < MAX_FULLSCREEN_DEPTH && document.fullscreenElement; depth += 1) {
    await document.exitFullscreen().catch(() => undefined);
  }
};

const isPlayable = (item: Item) =>
  getStorageItemKind(item) === StorageItemKind.VIDEO && !!getFolderItemOpenUrl(item);

/**
 * The folder browser's full-screen viewer, over any view: one item over black, stepping through the
 * whole folder — across its pages — until it is left, a video playing on arrival and a PDF showing
 * its pages. It asks for full screen on the document, and closes when the browser leaves it. While
 * open it has the keys: ←/→ step, Home/End jump to the ends, Enter opens the item in a new tab,
 * Space leaves, I the details, F2 renames, ⌘⌫ or Delete deletes, and the media keys
 * (`handleMediaKey`) drive the video or the PDF on show. The gallery steps its inline stage through
 * the same `step`.
 */
export const useFolderViewer = ({
  items,
  isPlaceholderData,
  page,
  pageCount,
  pageSize,
  total,
  folderTotal,
  currentId,
  onCurrentChange,
  onPageChange,
  onPrefetch,
  isFilesOnly,
  onOpen,
  onRename,
  onDelete,
  onToggleInfo,
  onExit,
}: Options) => {
  const [isOpen, setOpen] = useState(false);
  const [start, setStart] = useState<ViewerStart>();
  // Whether the viewer holds the browser's full screen: only then does leaving full screen close it.
  // An inline player's full screen coming and going, or a refused request, does not.
  const hasFullscreen = useRef(false);
  const pendingArrival = useRef<PendingArrival | null>(null);
  // The playing video's player and the PDF on show, inline or in the viewer — one stage is mounted
  // at a time.
  const playerControls = useRef<BunnyPlayerControls | null>(null);
  const pdfControls = useRef<PdfControls | null>(null);
  // The files of the page as last shown with the current item on it, to find where a deleted one
  // stood.
  const shownFiles = useRef<Item[]>([]);

  const index = isPlaceholderData ? -1 : items.findIndex((item) => item.id === currentId);
  const current = index >= 0 ? items[index] : undefined;
  const position = { index, count: items.length, page, pageCount };
  const isActive = isOpen || !isFilesOnly;

  const getStep = (direction: GalleryDirection) =>
    isFilesOnly ? stepFiles(position, direction, items) : stepGallery(position, direction);

  // The page's players get their URLs in one call: stepping from video to video spends none.
  usePrefetchVideoPlayerUrls(
    isPlaceholderData || !isActive
      ? []
      : items.filter((item) => isPlayable(item) && item.videoId).map((item) => item.videoId!),
  );

  // Near an end of the page, the neighbouring page loads ahead, so the step across is instant.
  useEffect(() => {
    if (index < 0 || !isActive) {
      return;
    }

    if (index >= items.length - 3 && page < pageCount) {
      onPrefetch(page + 1);
    }

    if (index <= 2 && page > 1) {
      onPrefetch(page - 1);
    }
  }, [index, isActive, items.length, page, pageCount, onPrefetch]);

  const exit = useCallback(() => {
    hasFullscreen.current = false;
    setOpen(false);
    void exitFullscreen();
    onExit?.(current);
  }, [onExit, current]);

  // Over the grid and the list, an item deleted under the viewer gives way to its neighbouring file
  // — or, with none, the viewer closes. The gallery follows a delete itself. Before the arrival
  // below: on a new page the item stepped from is missing too, and only a step still pending says
  // it was not deleted.
  useEffect(() => {
    if (!isFilesOnly || !isOpen || !currentId || isPlaceholderData || pendingArrival.current) {
      return;
    }

    if (index >= 0) {
      shownFiles.current = items.filter((item) => !item.isFolder);
      return;
    }

    const neighbourId = getNeighbourId(shownFiles.current, currentId);

    if (neighbourId && items.some((item) => item.id === neighbourId)) {
      onCurrentChange(neighbourId);
    } else {
      exit();
    }
  }, [isFilesOnly, isOpen, currentId, isPlaceholderData, index, items, onCurrentChange, exit]);

  // A step across pages lands once the page is in.
  useEffect(() => {
    const pending = pendingArrival.current;

    if (!pending || pending.page !== page || isPlaceholderData) {
      return;
    }

    if ('id' in pending) {
      pendingArrival.current = null;
      onCurrentChange(pending.id);
      return;
    }

    const arrival = pickArrival(items, pending.edge, isFilesOnly);

    if (arrival && 'index' in arrival) {
      pendingArrival.current = null;
      onCurrentChange(items[arrival.index].id);
    } else if (arrival && page < pageCount) {
      pendingArrival.current = { ...pending, page: page + 1 };
      onPageChange(page + 1);
    } else if (pending.from) {
      pendingArrival.current = pending.from;
      onPageChange(pending.from.page);
    } else {
      pendingArrival.current = null;
    }
  }, [items, isPlaceholderData, page, pageCount, isFilesOnly, onCurrentChange, onPageChange]);

  // The browser leaves full screen by itself on Esc, which never reaches the page: the viewer goes
  // with it. Leaving the page — into a folder — leaves full screen too.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleChange = () => {
      if (!document.fullscreenElement && hasFullscreen.current) {
        exit();
      }
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [isOpen, exit]);

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

  const open = useCallback(
    (id?: string) => {
      if (id && id !== currentId) {
        onCurrentChange(id);
      }

      setStart(undefined);
      setOpen(true);
      requestFullscreen().catch(() => undefined);
    },
    [currentId, onCurrentChange],
  );

  // The inline player went full screen by its own button: the viewer takes over and plays on from
  // where it was. The document takes the full screen while the player still holds it — removing
  // the full-screen element, as the viewer replacing the inline player does, leaves full screen
  // altogether — or, refused, once the player has left it; only then does the viewer open.
  const continueIn = async (next: ViewerStart) => {
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

    setStart(next);
    setOpen(true);
  };

  // A step across pages is on its way to this page: its arrival, not the gallery, selects there.
  const isArriving = useCallback(() => pendingArrival.current?.page === page, [page]);

  const step = (direction: GalleryDirection) => {
    const next = getStep(direction);

    if (!next) {
      return;
    }

    setStart(undefined);

    if ('index' in next) {
      onCurrentChange(items[next.index].id);
      return;
    }

    pendingArrival.current = {
      ...next,
      from: currentId && isFilesOnly ? { page, id: currentId } : undefined,
    };
    onPageChange(next.page);
  };

  // The keys of whatever plays or shows on the stage — a video's YouTube keys (the player keeps
  // none of its own, it hands the focus back), a PDF's scrolling. True when the key was theirs.
  const handleMediaKey = (event: KeyboardEvent): boolean => {
    const isModified = event.metaKey || event.ctrlKey;
    const pdf = pdfControls.current;
    const player = playerControls.current;

    if (isModified) {
      return false;
    }

    // A letter by its key, whatever the layout types (`getShortcutKey`).
    const key = getShortcutKey(event);

    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp':
        pdf?.scrollBy(key === 'ArrowDown' ? 1 : -1, 'line');
        return !!pdf;
      case 'PageDown':
      case 'PageUp':
        pdf?.scrollBy(key === 'PageDown' ? 1 : -1, 'page');
        return !!pdf;
      case 'k':
        player?.togglePlay();
        return !!player;
      case 'm':
        player?.toggleMute();
        return !!player;
      case 'j':
      case 'l':
        player?.seekBy(key === 'l' ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS);
        return !!player;
      default:
        return false;
    }
  };

  useWindowKeyDown((event) => {
    if (!isOpen || event.defaultPrevented || event.altKey || isTyping(event.target)) {
      return;
    }

    if (handleMediaKey(event)) {
      event.preventDefault();
      return;
    }

    const isModified = event.metaKey || event.ctrlKey;

    switch (getShortcutKey(event)) {
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
        if (!isModified || !current) {
          return;
        }
        onOpen(current);
        break;
      case 'Enter':
        if (isControl(event.target) || !current) {
          return;
        }
        onOpen(current);
        break;
      case ' ':
        if (isControl(event.target)) {
          return;
        }
        exit();
        break;
      case 'i':
        if (isModified) {
          return;
        }
        onToggleInfo();
        break;
      case 'F2':
        if (!current || !onRename) {
          return;
        }
        onRename(current);
        break;
      case 'Delete':
      case 'Backspace':
        // A bare Backspace does nothing here: the folder browser's up is not the viewer's.
        if ((event.key === 'Backspace' && !isModified) || !current || !onDelete) {
          return;
        }
        onDelete(current);
        break;
      default:
        return;
    }

    event.preventDefault();
  });

  return {
    isOpen,
    current,
    position,
    // Where the item stands in the whole folder — among its files, over the grid and the list.
    overall: getOverallPosition({ index, page, pageSize, total, folderTotal }, isFilesOnly),
    canPrev: !!getStep('prev'),
    canNext: !!getStep('next'),
    startTime: start?.id === current?.id ? start?.seconds : undefined,
    open,
    continueIn,
    exit,
    step,
    isArriving,
    handleMediaKey,
    playerControls,
    pdfControls,
  };
};

export type FolderViewer = ReturnType<typeof useFolderViewer>;
