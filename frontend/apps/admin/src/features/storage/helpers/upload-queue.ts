import type { CreatedUploadEntity } from '@/features/storage/types';
import { BrowserStorage } from '@packages/proto';
import { hasUsableCredentials } from './upload-batch';
import type { UploadKind } from './upload-rules';

// The rules of the upload queue behind the folder browser's drop, kept pure so they are tested
// without the store that runs them.

export type QueuedUploadStatus = 'queued' | 'creating' | 'uploading' | 'done' | 'failed';

export type QueuedUpload = {
  key: string;
  file: File;
  kind: UploadKind;
  userId: string;
  // Where it goes: a folder of `userId`, by the name it showed where it was dropped.
  folder: { id: string; name: string };
  status: QueuedUploadStatus;
  // 0–100, while `uploading`.
  progress: number;
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

export type UploadWork = { type: 'upload'; key: string } | { type: 'create'; keys: string[] };

const isReady = (item: QueuedUpload, now: number) =>
  !!item.entity && hasUsableCredentials(item.entity, now);

const groupOf = ({ userId, folder, kind }: QueuedUpload) => `${userId}|${folder.id}|${kind}`;

/**
 * What the queue does next, in the order the files were dropped: upload the first queued item when
 * its record is made, or make it — with the queued items after it that one create call can take,
 * the same kind into the same folder.
 */
export const pickUploadWork = (items: QueuedUpload[], now = Date.now()): UploadWork | undefined => {
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
  // Queued, being created or being uploaded.
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
