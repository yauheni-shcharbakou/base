import {
  capSelection,
  clickSelection,
  deselectAll,
  Direction,
  EMPTY_SELECTION,
  focusOnly,
  FolderSelection,
  getArrowTargetId,
  ItemRect,
  pruneSelection,
  removeFromSelection,
  selectAll,
  selectOnly,
  SelectionModifiers,
  stepSelection,
  toggleSelection,
} from '@/features/storage/helpers';
import type { BrowserStorage } from '@packages/proto';
import { useCallback, useMemo, useRef, useState } from 'react';

type Item = BrowserStorage.StorageObjectFolderItem;

type Options = {
  // The page shown.
  items?: Item[];
  // A new value starts a new selection: another folder, filter, or the gallery.
  resetKey: string;
  // The item marked on arrival — the folder just left. The keyboard is on it; nothing is selected.
  initialFocus?: string;
  // Where the keyboard is, for the URL: Back comes to this page with the item marked.
  onFocusChange: (id?: string) => void;
  // Items were left out of a selection that would have grown past `MAX_SELECTION`.
  onLimit?: () => void;
};

const initial = (focus?: string): FolderSelection => (focus ? focusOnly(focus) : EMPTY_SELECTION);

/**
 * Google Drive's selection over a folder, held in memory — only the item the keyboard is on reaches
 * the URL. It lasts across the folder's pages, sorts and both of Drive's views, so a selection can
 * be gathered page by page; what an item on another page is — its name, whether it is a folder — is
 * remembered from the page it was selected on. It holds at most `MAX_SELECTION` items, so every
 * action on it is one gateway call. The rules are the pure `folder-selection` helpers.
 */
export const useFolderSelection = ({
  items,
  resetKey,
  initialFocus,
  onFocusChange,
  onLimit,
}: Options) => {
  const [stored, setStored] = useState(() => initial(initialFocus));
  const [storedKey, setStoredKey] = useState(resetKey);
  // The selected items as last seen, for those the page no longer shows.
  const seen = useRef(new Map<string, Item>());

  // Adjusted while rendering, not in an effect: the first render after a reset already shows it
  // with nothing selected, instead of the old selection for a frame.
  if (storedKey !== resetKey) {
    setStoredKey(resetKey);
    setStored(initial(initialFocus));
    seen.current = new Map();
  }

  const order = useMemo(() => items?.map(({ id }) => id) ?? [], [items]);
  const selection = useMemo(
    () => (items ? pruneSelection(stored, order) : stored),
    [items, stored, order],
  );

  const update = useCallback(
    (wanted: FolderSelection) => {
      // Held to what one batch call takes, whatever grew it: a click, a range, ⌘A, the marquee.
      const { selection: next, isCapped } = capSelection(selection, wanted);

      if (isCapped) {
        onLimit?.();
      }

      const onPage = new Map(items?.map((item) => [item.id, item]));
      const remembered = new Map<string, Item>();

      next.ids.forEach((id) => {
        const item = onPage.get(id) ?? seen.current.get(id);

        if (item) {
          remembered.set(id, item);
        }
      });

      seen.current = remembered;
      setStored(next);

      if (next.focus !== selection.focus) {
        onFocusChange(next.focus);
      }
    },
    [items, selection, onFocusChange, onLimit],
  );

  // In the order they were selected: a move writes them in that order.
  const selectedItems = useMemo(() => {
    const onPage = new Map(items?.map((item) => [item.id, item]));

    return Array.from(selection.ids).flatMap((id) => {
      const item = onPage.get(id) ?? seen.current.get(id);
      return item ? [item] : [];
    });
  }, [items, selection]);

  const click = useCallback(
    (item: Item, modifiers: SelectionModifiers) =>
      update(clickSelection(selection, item.id, order, modifiers)),
    [update, selection, order],
  );

  const toggle = useCallback(
    (item: Item) => update(toggleSelection(selection, item.id)),
    [update, selection],
  );

  /** Makes the item the selection unless it is part of it already — a drag or a menu's target. */
  const ensureSelected = useCallback(
    (item: Item) => {
      if (!selection.ids.has(item.id)) {
        update(selectOnly(item.id));
      }
    },
    [update, selection],
  );

  const selectWholePage = useCallback(
    () => update(selectAll(selection, order)),
    [update, selection, order],
  );

  // The list's header checkbox: ticked while the whole page is selected.
  const toggleAll = useCallback(
    () =>
      update(
        order.every((id) => selection.ids.has(id))
          ? deselectAll(selection, order)
          : selectAll(selection, order),
      ),
    [update, selection, order],
  );

  const setIds = useCallback(
    (ids: string[]) => update({ ids: new Set(ids), anchor: ids[0], focus: selection.focus }),
    [update, selection.focus],
  );

  /** Moved or deleted: nothing is left of them to select. */
  const remove = useCallback(
    (ids: string[]) => update(removeFromSelection(selection, ids)),
    [update, selection],
  );

  const clear = useCallback(() => update(EMPTY_SELECTION), [update]);

  /** An arrow key, over the items as laid out; `extend` is Shift. False past an edge. */
  const step = useCallback(
    (rects: ItemRect[], direction: Direction, extend: boolean) => {
      const target = getArrowTargetId(rects, selection.focus, direction);

      if (!target) {
        return false;
      }

      update(stepSelection(selection, target, order, extend));
      return true;
    },
    [update, selection, order],
  );

  return {
    selectedIds: selection.ids,
    focusedId: selection.focus,
    selectedItems,
    click,
    toggle,
    ensureSelected,
    selectAll: selectWholePage,
    toggleAll,
    setIds,
    remove,
    clear,
    step,
  };
};
