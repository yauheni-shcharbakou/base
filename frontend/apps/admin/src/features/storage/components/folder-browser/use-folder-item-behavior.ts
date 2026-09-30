import { isFileDrag } from '@/features/storage/helpers';
import { ITEM_ID_ATTRIBUTE } from '@/features/storage/hooks';
import type { BrowserStorage } from '@packages/proto';
import { DragEvent, MouseEvent, useCallback, useRef, useState } from 'react';

type Item = BrowserStorage.StorageObjectFolderItem;

/** A folder something can be dropped on: a folder of the page, or a breadcrumb above it. */
export type DropFolder = { id: string; name: string };

// Private to this page: a drag from elsewhere — a file from the desktop, a link — is none of ours.
const DRAG_TYPE = 'application/x-storage-objects';

type Options = {
  // The selection, on every page.
  selectedItems: Item[];
  selectedIds: ReadonlySet<string>;
  onClick: (item: Item, modifiers: { toggle: boolean; range: boolean }) => void;
  onOpen: (item: Item) => void;
  onDragStart: (item: Item) => void;
  onDrop: (items: Item[], target: DropFolder) => void;
  // Files from the desktop, dropped on a folder. None: a folder takes no files.
  onFilesDrop?: (dataTransfer: DataTransfer, target: DropFolder) => void;
};

// The picture a drag of several items carries, in place of the one card under the pointer.
const showDragCount = (event: DragEvent, count: number) => {
  const ghost = document.createElement('div');

  ghost.textContent = `${count} items`;
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-100px',
    padding: '6px 12px',
    borderRadius: '8px',
    background: '#1a73e8',
    color: '#fff',
    font: '500 14px sans-serif',
  });
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 0, 0);
  // The browser has taken its picture by the next task.
  setTimeout(() => ghost.remove());
};

/**
 * What an item of the grid or the list does under the pointer, the way Drive's do: a click selects
 * (⌘ adds or takes, Shift a range), a double click opens, and a drag carries the selection — or the
 * item alone when it is not part of it — onto a folder of the page or a breadcrumb. Those take files
 * from the desktop too.
 */
export const useFolderItemBehavior = ({
  selectedItems,
  selectedIds,
  onClick,
  onOpen,
  onDragStart,
  onDrop,
  onFilesDrop,
}: Options) => {
  const dragged = useRef<Item[]>([]);
  const [dropTarget, setDropTarget] = useState<DropFolder>();

  const endDrag = useCallback(() => {
    dragged.current = [];
    setDropTarget(undefined);
  }, []);

  const getDropProps = useCallback(
    (folder: DropFolder) => ({
      onDragOver: (event: DragEvent) => {
        const { types } = event.dataTransfer;

        if (types.includes(DRAG_TYPE)) {
          // Not into itself: a folder of the drag is no target.
          if (dragged.current.some(({ id }) => id === folder.id)) {
            return;
          }

          event.dataTransfer.dropEffect = 'move';
        } else if (onFilesDrop && isFileDrag(types)) {
          event.dataTransfer.dropEffect = 'copy';
        } else {
          return;
        }

        event.preventDefault();
        setDropTarget((current) => (current?.id === folder.id ? current : folder));
      },
      onDragLeave: (event: DragEvent) => {
        // Leaving for one of its own children is no leaving.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTarget((current) => (current?.id === folder.id ? undefined : current));
        }
      },
      onDrop: (event: DragEvent) => {
        const moved = dragged.current;
        const isFiles = !moved.length && isFileDrag(event.dataTransfer.types);

        endDrag();

        if (moved.length) {
          event.preventDefault();
          onDrop(moved, folder);
        } else if (isFiles && onFilesDrop) {
          // Taken: the folder shown, around it, leaves a prevented drop alone.
          event.preventDefault();
          onFilesDrop(event.dataTransfer, folder);
        }
      },
    }),
    [endDrag, onDrop, onFilesDrop],
  );

  const getItemProps = useCallback(
    (item: Item) => ({
      [ITEM_ID_ATTRIBUTE]: item.id,
      draggable: true,
      onClick: (event: MouseEvent) =>
        onClick(item, { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey }),
      onDoubleClick: () => onOpen(item),
      onDragStart: (event: DragEvent) => {
        const moved = selectedIds.has(item.id) ? selectedItems : [item];

        dragged.current = moved;
        onDragStart(item);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(moved.map(({ id }) => id)));

        if (moved.length > 1) {
          showDragCount(event, moved.length);
        }
      },
      onDragEnd: endDrag,
      ...(item.isFolder ? getDropProps(item) : {}),
    }),
    [selectedItems, selectedIds, onClick, onOpen, onDragStart, endDrag, getDropProps],
  );

  return { getItemProps, getDropProps, dropTarget, dropTargetId: dropTarget?.id };
};

export type FolderItemBehavior = ReturnType<typeof useFolderItemBehavior> & {
  selectedIds: ReadonlySet<string>;
  focusedId?: string;
  onToggle: (item: Item) => void;
  // The "⋮" of an item.
  menu: {
    getFolderHref?: (id: string) => string;
    onMenuOpen: (item: Item) => void;
    onMove: (item: Item) => void;
    onDelete: (item: Item) => void;
    getActionCount: (item: Item) => number;
  };
};
