'use client';

import { getErrorMessage } from '@/common/helpers';
import { deleteOne } from '@/features/grpc/actions';
import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { completeFileUploads } from '@/features/storage/actions';
import { putToPresignedUrl } from '@/features/storage/helpers/presigned-upload';
import { hasUsableCredentials, pairCreatedEntities } from '@/features/storage/helpers/upload-batch';
import {
  findUploadOf,
  getCompleteDeadline,
  getRateLimitPause,
  getUploadFileId,
  pickUploadWork,
  QueuedUpload,
  UPLOAD_CONCURRENCY,
  UploadWork,
} from '@/features/storage/helpers/upload-queue';
import type { UploadKind } from '@/features/storage/helpers/upload-rules';
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

/**
 * A file to upload, the kind it goes as, the folder of the owner it goes into, the uploaded
 * folder it came in, if any, and the failed item it takes the place of, if any.
 */
export type UploadRequest = Pick<QueuedUpload, 'file' | 'kind' | 'folder' | 'group' | 'replaces'>;

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

// The bytes only. A file or an image is confirmed afterwards, with others (`complete`).
const sendBytes = (item: QueuedUpload, onProgress: (percent: number) => void): Promise<void> => {
  switch (item.kind) {
    case VIDEO:
      return uploadViaTus(item.file, (item.entity as CreatedVideo).upload, { onProgress });
    default:
      return putToPresignedUrl(item.file, (item.entity as CreatedFile | CreatedImage).upload, {
        onProgress,
      });
  }
};

/**
 * Drive's upload queue: files dropped on the folder browser, created and uploaded in the order they
 * came, a few transfers at a time, while the admin moves on to other pages. Every step that calls
 * the backend takes many files at once — records made ten at a time, uploads confirmed twenty at a
 * time — and a call refused by the gateway's rate limit pauses the queue instead of failing files.
 * It lives outside React, so no page owns it; `StorageUploadPanel` shows it and refreshes the
 * listings as items finish.
 */
class StorageUploadQueue {
  private items: QueuedUpload[] = [];
  private running = 0;
  private listeners = new Set<() => void>();
  private nextKey = monotonicFactory();
  private pausedUntil = 0;
  private wakeTimer?: ReturnType<typeof setTimeout>;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.items;

  /** Adds the files to the queue, and answers their keys in it, in order. */
  enqueue(files: UploadRequest[], userId: string): string[] {
    const added = files.map<QueuedUpload>(({ file, kind, folder, group, replaces }) => ({
      key: this.nextKey(),
      file,
      kind,
      userId,
      folder,
      group,
      replaces,
      status: 'queued',
      progress: 0,
    }));

    this.set([...this.items, ...added]);
    this.pump();

    return added.map(({ key }) => key);
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
              uploadedAt: undefined,
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

  /**
   * Forgets the failed items whose record sits on this file row: the folder browser has replaced
   * that upload with a new one, and a retry here would send its bytes to a record already deleted.
   */
  dismissFailedOf(fileId: string) {
    const keys = this.items
      .filter((item) => item.status === 'failed' && getUploadFileId(item) === fileId)
      .map(({ key }) => key);

    if (keys.length) {
      this.dismiss(keys);
    }
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
    clearTimeout(this.wakeTimer);

    while (this.running < UPLOAD_CONCURRENCY && Date.now() >= this.pausedUntil) {
      const work = pickUploadWork(this.items);

      if (!work) {
        break;
      }

      this.running += 1;

      const run = this.run(work);

      run.finally(() => {
        this.running -= 1;
        this.pump();
      });
    }

    this.scheduleWake();
  }

  private run(work: UploadWork): Promise<void> {
    switch (work.type) {
      case 'upload':
        return this.upload(work.key);
      case 'create':
        return this.create(work.keys);
      default:
        return this.complete(work.keys);
    }
  }

  // Nothing wakes the queue when uploaded items fall due or a pause runs out: a timer does. With
  // every slot busy there is no need — the next run to end pumps again.
  private scheduleWake() {
    const now = Date.now();
    const wakeAt = this.pausedUntil > now ? this.pausedUntil : getCompleteDeadline(this.items);

    if (wakeAt !== undefined && this.running < UPLOAD_CONCURRENCY) {
      this.wakeTimer = setTimeout(() => this.pump(), Math.max(wakeAt - now, 0));
    }
  }

  // Until the gateway's window resets. A later refusal may only push the pause out, never in.
  private pauseFor(pauseMs: number) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + pauseMs);
  }

  private async create(keys: string[]) {
    this.patch(keys, { status: 'creating' });
    const items = this.items.filter(({ key }) => keys.includes(key));

    try {
      const created = pairCreatedEntities(items, await createRecords(items[0].kind, items));
      // Back in the queue, now with credentials: the next turn uploads them.
      this.patch(keys, (item) => ({ status: 'queued', entity: created.get(item.key) }));
    } catch (error) {
      const pauseMs = getRateLimitPause(error);

      if (pauseMs) {
        this.pauseFor(pauseMs);
        this.patch(keys, { status: 'queued' });
        return;
      }

      this.patch(keys, { status: 'failed', error: getErrorMessage(error) });
    }
  }

  private async complete(keys: string[]) {
    this.patch(keys, { status: 'completing' });
    const items = this.items.filter(({ key }) => keys.includes(key));

    try {
      const results = unwrapActionResult(
        await completeFileUploads(items.map((item) => getUploadFileId(item) as string)),
      );

      this.patch(keys, (item) => {
        const result = results[items.indexOf(item)];

        return result?.file
          ? { status: 'done' }
          : { status: 'failed', error: result?.error ?? 'The upload was not confirmed' };
      });
    } catch (error) {
      const pauseMs = getRateLimitPause(error);

      if (pauseMs) {
        this.pauseFor(pauseMs);
        this.patch(keys, { status: 'uploaded' });
        return;
      }

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
      this.patch(
        [key],
        item.kind === VIDEO
          ? { status: 'done', progress: 100 }
          : { status: 'uploaded', progress: 100, uploadedAt: Date.now() },
      );
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

/**
 * The upload this tab's queue holds for a folder item (`findUploadOf`), redrawn as it moves: what
 * the item's stage reads its progress from, and whether its bytes can be sent again unpicked.
 */
export const useUploadOf = (item: { id: string; fileId?: string }): QueuedUpload | undefined =>
  findUploadOf(useStorageUploads(), item);
