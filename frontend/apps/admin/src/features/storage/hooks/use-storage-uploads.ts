'use client';

import { getErrorMessage } from '@/common/helpers';
import { deleteOne } from '@/features/grpc/actions';
import { hasUsableCredentials, pairCreatedEntities } from '@/features/storage/helpers/upload-batch';
import {
  pickUploadWork,
  QueuedUpload,
  UPLOAD_CONCURRENCY,
} from '@/features/storage/helpers/upload-queue';
import type { UploadKind } from '@/features/storage/helpers/upload-rules';
import { uploadViaPresignedUrl } from '@/features/storage/helpers/presigned-upload';
import {
  CreatedFile,
  CreatedImage,
  CreatedVideo,
  fileActionProvider,
  imageActionProvider,
  videoActionProvider,
} from '@/features/storage/providers';
import type { CreatedUploadEntity } from '@/features/storage/types';
import { uploadViaTus } from '@/features/video/helpers';
import { StorageDatabaseEntity } from '@packages/common';
import { BrowserStorage } from '@packages/proto';
import { useSyncExternalStore } from 'react';
import { monotonicFactory } from 'ulid';

export type UploadTarget = Pick<QueuedUpload, 'userId' | 'folder'>;

const { FILE, IMAGE, VIDEO } = BrowserStorage.StorageObjectType;

const RESOURCE_BY_KIND: Record<UploadKind, string> = {
  [FILE]: StorageDatabaseEntity.FILE,
  [IMAGE]: StorageDatabaseEntity.IMAGE,
  [VIDEO]: StorageDatabaseEntity.VIDEO,
};

const createRecords = (kind: UploadKind, items: QueuedUpload[]): Promise<CreatedUploadEntity[]> => {
  const { userId, folder } = items[0];
  const storage = { parent: folder.id };

  switch (kind) {
    case IMAGE:
      return imageActionProvider.createMany(userId, items, storage);
    case VIDEO:
      return videoActionProvider.createMany(userId, items, storage);
    default:
      return fileActionProvider.createMany(userId, items, storage);
  }
};

const sendBytes = (item: QueuedUpload, onProgress: (percent: number) => void): Promise<void> => {
  switch (item.kind) {
    case IMAGE: {
      // An image completes by its file's id, not its own.
      const { fileId, upload } = item.entity as CreatedImage;
      return uploadViaPresignedUrl(item.file, upload, fileId, { onProgress });
    }
    case VIDEO:
      return uploadViaTus(item.file, (item.entity as CreatedVideo).upload, { onProgress });
    default: {
      const { id, upload } = item.entity as CreatedFile;
      return uploadViaPresignedUrl(item.file, upload, id, { onProgress });
    }
  }
};

/**
 * Drive's upload queue: files dropped on the folder browser, created and uploaded in the order they
 * came, a few transfers at a time, while the admin moves on to other pages. It lives outside React,
 * so no page owns it; `StorageUploadPanel` shows it and refreshes the listings as items finish.
 */
class StorageUploadQueue {
  private items: QueuedUpload[] = [];
  private running = 0;
  private listeners = new Set<() => void>();
  private nextKey = monotonicFactory();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.items;

  enqueue(files: { file: File; kind: UploadKind }[], target: UploadTarget) {
    const added = files.map<QueuedUpload>(({ file, kind }) => ({
      ...target,
      key: this.nextKey(),
      file,
      kind,
      status: 'queued',
      progress: 0,
    }));

    this.set([...this.items, ...added]);
    this.pump();
  }

  /**
   * Queues failed items again. One whose record still has fresh credentials uploads with it; one
   * whose credentials have run out is created afresh, and the stale record is left to the storage
   * cleanup cron (ADR-0014, ADR-0015).
   */
  retry(keys?: string[]) {
    const now = Date.now();

    this.set(
      this.items.map((item) =>
        item.status === 'failed' && (!keys || keys.includes(item.key))
          ? {
              ...item,
              status: 'queued',
              progress: 0,
              error: undefined,
              entity:
                item.entity && hasUsableCredentials(item.entity, now) ? item.entity : undefined,
            }
          : item,
      ),
    );
    this.pump();
  }

  /**
   * Forgets finished and failed items — `keys`, or all of them. A failed item's record is deleted
   * so it does not sit PENDING until the cleanup cron, best effort: the cron still takes one that
   * survives.
   */
  dismiss(keys?: string[]) {
    const dismissed = this.items.filter(
      ({ key, status }) =>
        (status === 'done' || status === 'failed') && (!keys || keys.includes(key)),
    );

    dismissed.forEach(({ status, entity, kind }) => {
      if (status === 'failed' && entity) {
        deleteOne({ resource: RESOURCE_BY_KIND[kind], id: entity.id }).catch(() => undefined);
      }
    });

    this.set(this.items.filter((item) => !dismissed.includes(item)));
  }

  private set(items: QueuedUpload[]) {
    this.items = items;
    this.listeners.forEach((listener) => listener());
  }

  private patch(
    keys: string[],
    patch: Partial<QueuedUpload> | ((item: QueuedUpload) => Partial<QueuedUpload>),
  ) {
    this.set(
      this.items.map((item) =>
        keys.includes(item.key)
          ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) }
          : item,
      ),
    );
  }

  private pump() {
    while (this.running < UPLOAD_CONCURRENCY) {
      const work = pickUploadWork(this.items);

      if (!work) {
        return;
      }

      this.running += 1;

      const run = work.type === 'upload' ? this.upload(work.key) : this.create(work.keys);

      run.finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }

  private async create(keys: string[]) {
    this.patch(keys, { status: 'creating' });
    const items = this.items.filter(({ key }) => keys.includes(key));

    try {
      const created = pairCreatedEntities(items, await createRecords(items[0].kind, items));
      // Back in the queue, now with credentials: the next turn uploads them.
      this.patch(keys, (item) => ({ status: 'queued', entity: created.get(item.key) }));
    } catch (error) {
      this.patch(keys, { status: 'failed', error: getErrorMessage(error) });
    }
  }

  private async upload(key: string) {
    this.patch([key], { status: 'uploading', progress: 0 });
    const item = this.items.find((candidate) => candidate.key === key) as QueuedUpload;

    try {
      await sendBytes(item, (percent) => {
        const progress = Math.floor(percent);

        // Whole percents only: a byte-level event would redraw the panel hundreds of times.
        if (
          this.items.some((candidate) => candidate.key === key && candidate.progress !== progress)
        ) {
          this.patch([key], { progress });
        }
      });
      this.patch([key], { status: 'done', progress: 100 });
    } catch (error) {
      this.patch([key], { status: 'failed', error: getErrorMessage(error) });
    }
  }
}

export const storageUploadQueue = new StorageUploadQueue();

const NO_UPLOADS: QueuedUpload[] = [];

/** The upload queue as it stands, redrawn on every change. */
export const useStorageUploads = () =>
  useSyncExternalStore(
    storageUploadQueue.subscribe,
    storageUploadQueue.getSnapshot,
    () => NO_UPLOADS,
  );
