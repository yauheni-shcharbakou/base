'use client';

import { getNeighbourId, getShortcutKey } from '@/features/storage/helpers';
import { Box, CircularProgress, Stack } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, useEffect, useRef } from 'react';
import { GalleryBar } from './gallery-bar';
import { GalleryInfo } from './gallery-info';
import { GalleryStage } from './gallery-stage';
import { StorageItemThumbnail } from './storage-item-thumbnail';
import type { FolderViewer } from './use-folder-viewer';
import { isControl, isTyping, useWindowKeyDown } from './use-window-key-down';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  items: Item[];
  // The page's items are the previous page's while the next one loads.
  isPlaceholderData: boolean;
  selectedId?: string;
  isInfoShown: boolean;
  onInfoShownChange: (isShown: boolean) => void;
  onSelect: (id: string) => void;
  // A double click or Enter: a folder in place, anything else in the viewer.
  onOpen: (item: Item) => void;
  // The bar's Open: the item itself, in a new tab.
  onOpenExternal: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onRename?: (item: Item) => void;
  onPublicChange?: (item: Item, isPublic: boolean) => void;
  // The folder shown is public: nothing in it goes private.
  isPublicLocked?: boolean;
  onPreviewError?: () => void;
  getFolderHref?: (id: string) => string;
  // The folder browser's viewer, which this gallery's selection drives, and whose steps it takes.
  viewer: FolderViewer;
};

/**
 * Finder's gallery view: the selected item large, the page as a strip of small thumbnails below,
 * its details over the stage on demand. The keys are Finder's — ←/→ step (on to the next or
 * previous page at an edge), Home/End jump to the ends of the folder, Enter or ⌘↓ opens, Space
 * opens the full-screen viewer, I the details, F2 renames, ⌘⌫ or Delete deletes, ↑/↓ and
 * PgUp/PgDn scroll a shown PDF, and K / J / L / M drive a playing video (going up is the folder
 * browser's, in every view). The viewer, once open, has the keys. The selection is kept in the URL.
 * A click in the strip only selects: a video plays on a click on its poster, or by itself in the
 * viewer.
 */
export const FolderGalleryView: FC<Props> = ({
  items,
  isPlaceholderData,
  selectedId,
  isInfoShown,
  onInfoShownChange,
  onSelect,
  onOpen,
  onOpenExternal,
  onDelete,
  onRename,
  onPublicChange,
  isPublicLocked,
  onPreviewError,
  getFolderHref,
  viewer,
}) => {
  const strip = useRef<HTMLDivElement>(null);
  const thumbs = useRef(new Map<string, HTMLElement>());
  // The page as last shown with the selection on it, to find where a deleted item stood.
  const shownItems = useRef(items);
  const { isArriving } = viewer;

  const index = isPlaceholderData ? -1 : items.findIndex((item) => item.id === selectedId);
  const selected = index >= 0 ? items[index] : undefined;

  // Select on arrival: the neighbour of an item just deleted, as Finder does; else the first item
  // when the URL names none on this page. A step across pages selects its own end, in the viewer.
  useEffect(() => {
    if (isPlaceholderData || !items.length || isArriving()) {
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
  }, [items, isPlaceholderData, index, selectedId, onSelect, isArriving]);

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

  const toggleInfo = () => onInfoShownChange(!isInfoShown);

  useWindowKeyDown((event) => {
    if (viewer.isOpen || event.defaultPrevented || event.altKey || isTyping(event.target)) {
      return;
    }

    if (viewer.handleMediaKey(event)) {
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
        viewer.step(event.key === 'ArrowRight' ? 'next' : 'prev');
        break;
      case 'Home':
        viewer.step('first');
        break;
      case 'End':
        viewer.step('last');
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
        if (isControl(event.target) || !selected) {
          return;
        }
        viewer.open(selected.id);
        break;
      case 'i':
        if (isModified) {
          return;
        }
        toggleInfo();
        break;
      case 'F2':
        if (!selected || !onRename) {
          return;
        }
        onRename(selected);
        break;
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

  return (
    <Stack gap={1.5}>
      <Box
        onDoubleClick={() => selected && viewer.open(selected.id)}
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
        {!viewer.isOpen &&
          (selected ? (
            <GalleryStage
              key={selected.id}
              item={selected}
              onFullscreen={(seconds) => viewer.continueIn({ id: selected.id, seconds })}
              onOpen={onOpenExternal}
              onPreviewError={onPreviewError}
              playerControls={viewer.playerControls}
              pdfControls={viewer.pdfControls}
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
        {selected && !viewer.isOpen && (
          <GalleryBar
            item={selected}
            position={viewer.overall}
            isInfoShown={isInfoShown}
            onToggleInfo={toggleInfo}
            onToggleViewer={() => viewer.open(selected.id)}
            onOpen={onOpenExternal}
            onDelete={onDelete}
            onRename={onRename}
            onPublicChange={onPublicChange}
            isPublicLocked={isPublicLocked}
            getFolderHref={getFolderHref}
          />
        )}
        {selected && isInfoShown && !viewer.isOpen && <GalleryInfo item={selected} />}
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
    </Stack>
  );
};
