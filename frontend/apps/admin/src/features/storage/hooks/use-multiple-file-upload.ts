'use client';

import { getErrorMessage } from '@/common/helpers';
import { deleteOne } from '@/features/grpc/actions';
import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import {
  attachCreatedEntities,
  pairCreatedEntities,
  planUploadBatch,
} from '@/features/storage/helpers/upload-batch';
import { CreatedUploadEntity, StorageUploadItem, UploadFileAction } from '@/features/storage/types';
import { useNotification } from '@refinedev/core';
import { useCallback, useState } from 'react';
import { monotonicFactory } from 'ulid';

type Params = {
  // The resource the create call makes (file, image or video) — what an abandoned item deletes.
  resource: string;
  // Same as in `useSingleFileUpload`: how each file's bytes leave the browser.
  uploadFileAction: UploadFileAction;
};

type StorageUploadMap = {
  [id: string]: StorageUploadItem;
};

export const useMultipleFileUpload = ({ resource, uploadFileAction }: Params) => {
  const [uploadMap, setUploadMap] = useState<StorageUploadMap>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);
  const [failedItems, setFailedItems] = useState<StorageUploadItem[]>([]);

  const { open } = useNotification();

  /**
   * Deletes the rows already created for items the user dropped, so they do not sit PENDING until
   * the storage cleanup cron. Best effort and in the background: a row that survives is still the
   * cron's, so a failure is reported and nothing more.
   */
  const discardEntities = useCallback(
    async (items: StorageUploadItem[]) => {
      const entities = items.flatMap(({ entity }) => (entity ? [entity] : []));

      const results = await Promise.allSettled(
        entities.map(async (entity) =>
          unwrapActionResult(await deleteOne({ resource, id: entity.id })),
        ),
      );

      const failed = results.filter((result) => result.status === 'rejected');

      if (failed.length) {
        open?.({
          type: 'error',
          message: `Could not delete ${failed.length} abandoned ${resource} record(s)`,
          description: getErrorMessage(failed[0].reason),
          key: `${resource}-discard-error-${Date.now()}`,
        });
      }
    },
    [open, resource],
  );

  // A new selection replaces the old one rather than adding to it: the form field holds only what
  // was just picked, so the map has to as well, or files no longer shown would still be uploaded.
  const addFiles = useCallback(
    (files: File[] = []) => {
      discardEntities(Object.values(uploadMap));

      setUploadMap(() => {
        return files.reduce((acc: StorageUploadMap, file) => {
          const key = monotonicFactory()();
          acc[key] = { file, key };
          return acc;
        }, {});
      });

      setFailedItems(() => []);
      setUploadedCount(() => 0);
      setItemsCount(() => files.length);
    },
    [discardEntities, uploadMap],
  );

  const handleFinish = (id: string) => {
    setUploadMap((prev) => {
      const newMap = { ...prev };
      delete newMap[id];
      return newMap;
    });

    setUploadedCount((prev) => prev + 1);
  };

  // Takes the item itself: `uploadMap` in this closure is the snapshot from before the upload
  // started, so it knows nothing about the entities created since.
  const handleError = (item: StorageUploadItem) => {
    setFailedItems((prev) => [...prev, item]);
  };

  const handleDelete = useCallback(
    (key: string) => {
      const item = uploadMap[key];

      if (item) {
        discardEntities([item]);
      }

      setUploadMap((prev) => {
        const newMap = { ...prev };
        delete newMap[key];
        return newMap;
      });

      setFailedItems((prev) => prev.filter((e) => e.key !== key));
    },
    [discardEntities, uploadMap],
  );

  const notifyError = (message: string, error: unknown) => {
    open?.({
      type: 'error',
      message,
      description: getErrorMessage(error),
      key: `${resource}-upload-error-${Date.now()}`,
    });
  };

  /**
   * Creates and uploads every item still in the map, batch by batch. A finished item leaves the
   * map; a failed one stays, so calling this again retries only the failures.
   *
   * A retried item reuses the entity of its earlier attempt — creating it again would leave the
   * first row an orphan — unless that entity's upload credentials have expired. Then it is created
   * afresh, and the stale row is left to the storage cleanup cron (ADR-0014, ADR-0015).
   */
  const handleUpload = async <Record extends CreatedUploadEntity = CreatedUploadEntity>(
    createCallback: (items: StorageUploadItem[]) => Promise<Record[]>,
    batchSize = 10,
  ): Promise<boolean> => {
    setIsUploading(() => true);
    let isSuccess = true;

    const ids = Object.keys(uploadMap);

    setUploadedCount(() => 0);
    setItemsCount(() => ids.length);
    setFailedItems(() => []);

    try {
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize).map((key) => uploadMap[key]);

        const { toCreate, reused: entityByKey } = planUploadBatch(batch);

        if (toCreate.length) {
          try {
            const created = pairCreatedEntities(toCreate, await createCallback(toCreate));

            created.forEach((entity, key) => entityByKey.set(key, entity));
            setUploadMap((prev) => attachCreatedEntities(prev, created));
          } catch (error) {
            // The items stay in the map without an entity, so the next attempt creates them. The
            // rest of the batch and the batches after it still go ahead.
            notifyError('Upload error', error);
            isSuccess = false;
          }
        }

        for (const uploadItem of batch) {
          const entity = entityByKey.get(uploadItem.key);

          if (!entity) {
            handleError(uploadItem);
            isSuccess = false;
            continue;
          }

          try {
            await uploadFileAction(uploadItem.file, entity);
            handleFinish(uploadItem.key);
          } catch (err) {
            notifyError(`Upload error: ${uploadItem.file.name}`, err);
            handleError({ ...uploadItem, entity });
            isSuccess = false;
          }
        }
      }
    } finally {
      setIsUploading(() => false);
    }

    return isSuccess;
  };

  return {
    addFiles,
    handleUpload,
    handleDelete,
    isUploading,
    failedItems,
    itemsCount,
    uploadedCount,
  };
};
