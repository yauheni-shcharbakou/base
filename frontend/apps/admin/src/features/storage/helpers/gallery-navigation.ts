export type GalleryDirection = 'prev' | 'next' | 'first' | 'last';

/** Where a gallery's selection is: its index on the page (-1 for none), and the page among all. */
export type GalleryPosition = {
  index: number;
  count: number;
  page: number;
  pageCount: number;
};

/**
 * A gallery step: another index on this page, or another page to load and then select on — its
 * first or last item, so the selection walks the whole folder as if it were one strip.
 */
export type GalleryStep = { index: number } | { page: number; edge: 'first' | 'last' } | null;

export const stepGallery = (
  { index, count, page, pageCount }: GalleryPosition,
  direction: GalleryDirection,
): GalleryStep => {
  if (!count) {
    return null;
  }

  switch (direction) {
    case 'first':
      if (page > 1) {
        return { page: 1, edge: 'first' };
      }
      return index === 0 ? null : { index: 0 };

    case 'last':
      if (page < pageCount) {
        return { page: pageCount, edge: 'last' };
      }
      return index === count - 1 ? null : { index: count - 1 };

    case 'prev':
      if (index < 0) {
        return { index: 0 };
      }
      if (index > 0) {
        return { index: index - 1 };
      }
      return page > 1 ? { page: page - 1, edge: 'last' } : null;

    case 'next':
      if (index < count - 1) {
        return { index: index + 1 };
      }
      return page < pageCount ? { page: page + 1, edge: 'first' } : null;

    default:
      return null;
  }
};

/** What to select once an item is gone: the one after it, else the one before, else nothing. */
export const getNeighbourId = (items: { id: string }[], id: string): string | undefined => {
  const index = items.findIndex((item) => item.id === id);

  if (index < 0) {
    return;
  }

  return (items[index + 1] ?? items[index - 1])?.id;
};

type Entry = { id: string; isFolder?: boolean };

/**
 * A viewer's step over the files alone, as Drive's: the folders — always listed first — are a wall.
 * A step back onto one goes nowhere; Home lands on the page's first file, or starts from the
 * folder's first page, where `pickArrival` finds it.
 */
export const stepFiles = (
  position: GalleryPosition,
  direction: GalleryDirection,
  items: Entry[],
): GalleryStep => {
  const next = stepGallery(position, direction);

  if (!next || !('index' in next) || !items[next.index]?.isFolder) {
    return next;
  }

  if (direction !== 'first') {
    return null;
  }

  const first = items.findIndex((item) => !item.isFolder);
  return first < 0 || first === position.index ? null : { index: first };
};

/**
 * What a step across pages lands on once the page is loaded: its first or last item — its first
 * file, over files alone, or the page after it when it has none. Nothing when the item at the end
 * is a folder: the step went past the files, and goes back.
 */
export type GalleryArrival = { index: number } | { page: 'next' } | null;

export const pickArrival = (
  items: Entry[],
  edge: 'first' | 'last',
  isFilesOnly: boolean,
): GalleryArrival => {
  if (!items.length) {
    return null;
  }

  if (edge === 'last') {
    const last = items.length - 1;
    return isFilesOnly && items[last].isFolder ? null : { index: last };
  }

  if (!isFilesOnly) {
    return { index: 0 };
  }

  const first = items.findIndex((item) => !item.isFolder);
  return first < 0 ? { page: 'next' } : { index: first };
};
