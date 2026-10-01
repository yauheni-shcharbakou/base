import { getUploadFileId, QueuedUpload } from './upload-queue';

/**
 * A failed item a new upload is taking the place of. The service has deleted it — that is what
 * frees its name — but it stays on the page, where its stage shows the new upload's progress,
 * until the listing brings the new item: the viewer never steps to a neighbour in between.
 */
export type ReplacedItem<Item> = {
  // The new upload's key in the queue.
  key: string;
  // The failed item as it was listed, and where it stood on its page.
  item: Item;
  index: number;
  // The listing it stood in — folder, page, order, filters. It is held nowhere else.
  scope: string;
  // When the new upload came to rest, done or failed: the listing is given a moment from then.
  settledAt?: number;
};

// How long the listing has to bring the new item once its upload rests. The upload box refreshes
// the listings half a second after; an item still missing by then landed on another page.
export const REPLACED_HOLD_MS = 5000;

/** The page with the replaced item still on it, where it stood; untouched for another listing. */
export const holdReplacedItem = <Item extends { id: string }>(
  items: Item[],
  scope: string,
  held?: Pick<ReplacedItem<Item>, 'item' | 'index' | 'scope'>,
): Item[] => {
  if (!held || held.scope !== scope || items.some(({ id }) => id === held.item.id)) {
    return items;
  }

  return [...items.slice(0, held.index), held.item, ...items.slice(held.index)];
};

export type ReplaceStep =
  | { type: 'hold' }
  // The upload has just come to rest: the wait for the listing starts.
  | { type: 'settle' }
  // The new item is listed: it takes the place.
  | { type: 'swap'; id: string }
  // Nothing is coming to this page: the held item goes, as a deleted one does.
  | { type: 'release' };

/** The new item on the page, found by the file row its upload's record sits on. */
export const findReplacement = <Item extends { id: string; fileId?: string }>(
  upload: Pick<QueuedUpload, 'kind' | 'entity'> | undefined,
  items: Item[],
): Item | undefined => {
  const fileId = upload && getUploadFileId(upload);

  return fileId ? items.find((item) => item.fileId === fileId) : undefined;
};

type ReplaceState = {
  // The new upload as the queue holds it; none once it was dismissed.
  upload?: Pick<QueuedUpload, 'status' | 'kind' | 'entity'>;
  // The page as listed, without the held item, and the listing it is.
  items: { id: string; fileId?: string }[];
  scope: string;
  now: number;
};

/** What holding a replaced item does next. */
export const getReplaceStep = (
  held: Pick<ReplacedItem<unknown>, 'scope' | 'settledAt'>,
  { upload, items, scope, now }: ReplaceState,
): ReplaceStep => {
  if (held.scope !== scope) {
    return { type: 'release' };
  }

  const listed = findReplacement(upload, items);

  if (listed) {
    return { type: 'swap', id: listed.id };
  }

  // Dismissed, or failed before its record was made: no item will come.
  if (!upload || (upload.status === 'failed' && !upload.entity)) {
    return { type: 'release' };
  }

  if (upload.status !== 'done' && upload.status !== 'failed') {
    return { type: 'hold' };
  }

  if (held.settledAt === undefined) {
    return { type: 'settle' };
  }

  return now - held.settledAt >= REPLACED_HOLD_MS ? { type: 'release' } : { type: 'hold' };
};
