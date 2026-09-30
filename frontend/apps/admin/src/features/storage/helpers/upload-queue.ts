import type { CreatedUploadEntity } from '@/features/storage/types';
import { BrowserStorage } from '@packages/proto';
import { hasUsableCredentials } from './upload-batch';
import type { UploadKind } from './upload-rules';

// The rules of the upload queue behind the folder browser's drop, kept pure so they are tested
// without the store that runs them.

// `uploaded`: the bytes are at the provider, and the row waits to be confirmed with others at once
// (`completing`). A video never is — Bunny Stream reports its own upload through a webhook.
export type QueuedUploadStatus =
  'queued' | 'creating' | 'uploading' | 'uploaded' | 'completing' | 'done' | 'failed';

export type QueuedUpload = {
  key: string;
  file: File;
  kind: UploadKind;
  userId: string;
  // Where it goes: a folder of `userId`, by the name it showed where it was dropped.
  folder: { id: string; name: string };
  // The uploaded folder it came in, made for the upload: the top of its tree, under the name it
  // was made with. The upload box shows the folder as one row. None for a file dropped alone.
  group?: { id: string; name: string };
  status: QueuedUploadStatus;
  // 0–100, while `uploading`.
  progress: number;
  // When the bytes were sent, while `uploaded`.
  uploadedAt?: number;
  error?: string;
  // The record the create call made, with its upload credentials. Kept through a failure, so a
  // retry uploads with it instead of making a second record.
  entity?: CreatedUploadEntity;
};

// Transfers at once. More would split the bandwidth without finishing anything sooner, and every
// transfer holds credentials that are ticking.
export const UPLOAD_CONCURRENCY = 3;

// Records one create call makes. A video's credentials cover a TUS upload that can run for many
// minutes, so a video is created only when its turn comes, as the videos form does.
export const UPLOAD_CREATE_BATCH: Record<UploadKind, number> = {
  [BrowserStorage.StorageObjectType.FILE]: 10,
  [BrowserStorage.StorageObjectType.IMAGE]: 10,
  [BrowserStorage.StorageObjectType.VIDEO]: 1,
};

// Uploads confirmed by one call. A confirmation is cheap and the gateway counts calls, not files.
export const UPLOAD_COMPLETE_BATCH = 20;

// How long an uploaded item waits for others to be confirmed with. Short: until then it spins.
export const UPLOAD_COMPLETE_DELAY_MS = 1000;

// How long the queue stops calling the backend once the gateway's rate limit has refused a call
// without saying how long to wait.
export const UPLOAD_RATE_LIMIT_PAUSE_MS = 30 * 1000;

export type UploadWork =
  | { type: 'upload'; key: string }
  | { type: 'create'; keys: string[] }
  | { type: 'complete'; keys: string[] };

// Still on the way to `uploaded`: once none is, nothing is worth waiting for.
const isComing = ({ status }: QueuedUpload) =>
  status === 'queued' || status === 'creating' || status === 'uploading';

/** When the oldest uploaded item is due to be confirmed, even if no others joined it. */
export const getCompleteDeadline = (items: QueuedUpload[]): number | undefined => {
  const waiting = items.filter(({ status }) => status === 'uploaded');

  if (!waiting.length) {
    return;
  }

  return Math.min(...waiting.map(({ uploadedAt = 0 }) => uploadedAt)) + UPLOAD_COMPLETE_DELAY_MS;
};

/**
 * How long to wait out a call the gateway refused for the per-user rate limit: until its window
 * resets (`retryAfterMs`), or `UPLOAD_RATE_LIMIT_PAUSE_MS` when it did not say. None for any other
 * failure, which fails the items instead.
 */
export const getRateLimitPause = (error: unknown): number | undefined => {
  const { statusCode, retryAfterMs } = (error ?? {}) as {
    statusCode?: number;
    retryAfterMs?: number;
  };

  if (statusCode !== 429) {
    return;
  }

  return retryAfterMs && retryAfterMs > 0 ? retryAfterMs : UPLOAD_RATE_LIMIT_PAUSE_MS;
};

const isReady = (item: QueuedUpload, now: number) =>
  !!item.entity && hasUsableCredentials(item.entity, now);

const groupOf = ({ userId, folder, kind }: QueuedUpload) => `${userId}|${folder.id}|${kind}`;

/**
 * What the queue does next. First, confirm the uploaded items, once a batch of them is full, the
 * oldest has waited long enough (`getCompleteDeadline`), or nothing else is on its way. Then, in
 * the order the files were dropped: upload the first queued item when its record is made, or make
 * it — with the queued items after it that one create call can take, the same kind into the same
 * folder.
 */
export const pickUploadWork = (items: QueuedUpload[], now = Date.now()): UploadWork | undefined => {
  const uploaded = items.filter(({ status }) => status === 'uploaded');

  if (
    uploaded.length &&
    (uploaded.length >= UPLOAD_COMPLETE_BATCH ||
      (getCompleteDeadline(items) ?? Infinity) <= now ||
      !items.some(isComing))
  ) {
    return {
      type: 'complete',
      keys: uploaded.slice(0, UPLOAD_COMPLETE_BATCH).map(({ key }) => key),
    };
  }

  const next = items.find(({ status }) => status === 'queued');

  if (!next) {
    return;
  }

  if (isReady(next, now)) {
    return { type: 'upload', key: next.key };
  }

  const group = groupOf(next);
  const keys = items
    .filter((item) => item.status === 'queued' && !isReady(item, now) && groupOf(item) === group)
    .slice(0, UPLOAD_CREATE_BATCH[next.kind])
    .map(({ key }) => key);

  return { type: 'create', keys };
};

export type UploadSummary = {
  total: number;
  done: number;
  failed: number;
  // Not done nor failed yet: queued, being created, uploaded or confirmed.
  active: number;
  // How far the whole queue is, by bytes, 0–100.
  progress: number;
};

export const summarizeUploads = (items: QueuedUpload[]): UploadSummary => {
  const summary: UploadSummary = {
    total: items.length,
    done: 0,
    failed: 0,
    active: 0,
    progress: 0,
  };
  let bytes = 0;
  let sent = 0;

  items.forEach(({ status, progress, file }) => {
    bytes += file.size;

    if (status === 'done') {
      summary.done += 1;
      sent += file.size;
    } else if (status === 'failed') {
      summary.failed += 1;
    } else {
      summary.active += 1;
      sent += (file.size * progress) / 100;
    }
  });

  summary.progress = bytes ? (sent * 100) / bytes : 0;
  return summary;
};

/** A row of the upload box: a file dropped alone, or an uploaded folder with all its files. */
export type UploadRow =
  | { type: 'file'; key: string; item: QueuedUpload }
  | {
      type: 'folder';
      key: string;
      folder: { id: string; name: string };
      items: QueuedUpload[];
      summary: UploadSummary;
    };

type FolderUploadRow = Extract<UploadRow, { type: 'folder' }>;

/** The queue as the upload box lists it: a folder's files folded into one row where it first shows. */
export const groupUploads = (items: QueuedUpload[]): UploadRow[] => {
  const rows: UploadRow[] = [];
  const folderRows = new Map<string, FolderUploadRow>();

  items.forEach((item) => {
    const row = item.group && folderRows.get(item.group.id);

    if (row) {
      row.items.push(item);
    } else if (item.group) {
      const created: FolderUploadRow = {
        type: 'folder',
        key: item.group.id,
        folder: item.group,
        items: [item],
        summary: summarizeUploads([]),
      };

      folderRows.set(item.group.id, created);
      rows.push(created);
    } else {
      rows.push({ type: 'file', key: item.key, item });
    }
  });

  folderRows.forEach((row) => {
    row.summary = summarizeUploads(row.items);
  });

  return rows;
};

export type UploadRowStatus = 'active' | 'failed' | 'done';

/** A folder is on its way while any of its files is, and failed once only failures are left. */
export const getUploadRowStatus = (row: UploadRow): UploadRowStatus => {
  if (row.type === 'file') {
    const { status } = row.item;
    return status === 'failed' || status === 'done' ? status : 'active';
  }

  if (row.summary.active) {
    return 'active';
  }

  return row.summary.failed ? 'failed' : 'done';
};
