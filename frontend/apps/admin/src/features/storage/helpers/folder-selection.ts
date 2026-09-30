/**
 * Google Drive's selection over a folder, as pure state: the ids selected — on any of its pages —
 * the anchor a Shift-click or Shift-arrow extends from, and the item the keyboard is on. The last
 * two are on the page shown. `order` is that page's items in the order they show.
 */
export type FolderSelection = {
  ids: ReadonlySet<string>;
  anchor?: string;
  focus?: string;
};

export const EMPTY_SELECTION: FolderSelection = { ids: new Set() };

export type SelectionModifiers = {
  // ⌘ on a Mac, Ctrl elsewhere: add or take one item.
  toggle?: boolean;
  // Shift: everything from the anchor to the item.
  range?: boolean;
};

export type ItemRect = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Only the item. */
export const selectOnly = (id: string): FolderSelection => ({
  ids: new Set([id]),
  anchor: id,
  focus: id,
});

/**
 * Nothing selected, with the keyboard on the item — the folder just left, marked on the way back up.
 * Only marked: a checkbox or a ⌘-click starts the selection afresh, so an action never takes the
 * folder along unseen.
 */
export const focusOnly = (id: string): FolderSelection => ({
  ids: new Set(),
  anchor: id,
  focus: id,
});

const rangeOf = (order: string[], from: string, to: string): string[] => {
  const start = order.indexOf(from);
  const end = order.indexOf(to);

  if (start < 0 || end < 0) {
    return [to];
  }

  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
};

/**
 * A click on an item: alone, it selects only the item; with ⌘ it adds or takes the item; with
 * Shift it selects the range from the anchor, which ⌘ adds to what was selected before.
 */
export const clickSelection = (
  selection: FolderSelection,
  id: string,
  order: string[],
  { toggle = false, range = false }: SelectionModifiers = {},
): FolderSelection => {
  if (range && selection.anchor) {
    const ids = rangeOf(order, selection.anchor, id);
    const base = toggle ? Array.from(selection.ids) : [];

    return { ids: new Set(base.concat(ids)), anchor: selection.anchor, focus: id };
  }

  if (toggle) {
    const ids = new Set(Array.from(selection.ids));

    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }

    return { ids, anchor: id, focus: id };
  }

  return selectOnly(id);
};

/** A checkbox: adds or takes the item, as ⌘-click does. */
export const toggleSelection = (selection: FolderSelection, id: string): FolderSelection =>
  clickSelection(selection, id, [], { toggle: true });

/** ⌘A: the whole page, added to what other pages have selected. */
export const selectAll = (selection: FolderSelection, order: string[]): FolderSelection => ({
  ids: new Set(Array.from(selection.ids).concat(order)),
  anchor: selection.anchor ?? order[0],
  focus: selection.focus ?? order[0],
});

/** The list's header checkbox, unticked: the page leaves the selection, other pages stay in it. */
export const deselectAll = (selection: FolderSelection, order: string[]): FolderSelection => {
  const onPage = new Set(order);

  return {
    ids: new Set(Array.from(selection.ids).filter((id) => !onPage.has(id))),
    focus: selection.focus,
  };
};

/** Without the items — moved or deleted, so nothing is left to select. */
export const removeFromSelection = (
  selection: FolderSelection,
  removed: string[],
): FolderSelection => {
  const gone = new Set(removed);

  return {
    ids: new Set(Array.from(selection.ids).filter((id) => !gone.has(id))),
    anchor: selection.anchor && !gone.has(selection.anchor) ? selection.anchor : undefined,
    focus: selection.focus && !gone.has(selection.focus) ? selection.focus : undefined,
  };
};

/**
 * The keyboard's step to `id`: it selects only that item, or with Shift the range from the anchor
 * to it — Finder's and Drive's Shift-arrow.
 */
export const stepSelection = (
  selection: FolderSelection,
  id: string,
  order: string[],
  extend: boolean,
): FolderSelection =>
  extend && selection.anchor
    ? { ids: new Set(rangeOf(order, selection.anchor, id)), anchor: selection.anchor, focus: id }
    : selectOnly(id);

/**
 * The selection on the page shown now: the anchor and the keyboard stay only on an item it shows.
 * The ids selected on other pages stay selected, as in Drive. The same object back when nothing
 * changed, so a caller's state stays put.
 */
export const pruneSelection = (selection: FolderSelection, order: string[]): FolderSelection => {
  const present = new Set(order);
  const anchor = selection.anchor && present.has(selection.anchor) ? selection.anchor : undefined;
  const focus = selection.focus && present.has(selection.focus) ? selection.focus : undefined;

  if (anchor === selection.anchor && focus === selection.focus) {
    return selection;
  }

  return { ids: selection.ids, anchor, focus };
};

const centerX = (rect: ItemRect) => (rect.left + rect.right) / 2;

/**
 * The item an arrow key goes to from `fromId`, over the items as laid out. Left and right follow the
 * page's order, wrapping to the next row as Drive does. Up and down go to the nearest row above or
 * below — the grid's folders and files are two grids of their own widths — and in it to the item
 * closest across. None past an edge.
 */
export const getArrowTargetId = (
  rects: ItemRect[],
  fromId: string | undefined,
  direction: Direction,
): string | undefined => {
  if (!rects.length) {
    return undefined;
  }

  const index = rects.findIndex(({ id }) => id === fromId);

  if (index < 0) {
    return rects[0].id;
  }

  if (direction === 'left' || direction === 'right') {
    return rects[index + (direction === 'right' ? 1 : -1)]?.id;
  }

  const from = rects[index];
  const isDown = direction === 'down';
  const candidates = rects.filter((rect) =>
    isDown ? rect.top >= from.bottom - 1 : rect.bottom <= from.top + 1,
  );

  if (!candidates.length) {
    return undefined;
  }

  // The nearest row first, then the nearest item across in it.
  const rowEdge = isDown
    ? Math.min(...candidates.map((rect) => rect.top))
    : Math.max(...candidates.map((rect) => rect.bottom));
  const row = candidates.filter((rect) =>
    isDown ? rect.top < rowEdge + 1 : rect.bottom > rowEdge - 1,
  );

  return row.reduce((best, rect) =>
    Math.abs(centerX(rect) - centerX(from)) < Math.abs(centerX(best) - centerX(from)) ? rect : best,
  ).id;
};
