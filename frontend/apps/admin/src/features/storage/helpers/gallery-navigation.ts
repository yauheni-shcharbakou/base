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
