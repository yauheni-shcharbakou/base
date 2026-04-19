'use client';

import { internalHttpClient } from '@/common/clients';
import { getErrorMessage } from '@/common/helpers';
import { StorageUploadItem } from '@/features/storage/types';
import { useNotification } from '@refinedev/core';
import { useState } from 'react';
import { GrpcIdField } from '@packages/grpc';
import { monotonicFactory } from 'ulid';

type Params = {
  resource: string;
};

type Entity = GrpcIdField & { uploadId: string };

type StorageUploadMap = {
  [id: string]: StorageUploadItem;
};

export const useMultipleFileUpload = ({ resource }: Params) => {
  const [uploadMap, setUploadMap] = useState<StorageUploadMap>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);
  const [failedItems, setFailedItems] = useState<StorageUploadItem[]>([]);

  const { open } = useNotification();

  const addFiles = (files: File[] = []) => {
    if (!files.length) {
      setUploadMap(() => ({}));
      setUploadedCount(() => 0);
      setItemsCount(() => 0);
      return;
    }

    setUploadMap((prev) => {
      return files.reduce(
        (acc: StorageUploadMap, file) => {
          const uploadId = monotonicFactory()();
          acc[uploadId] = { file, uploadId };
          return acc;
        },
        { ...prev },
      );
    });

    setUploadedCount(() => 0);
    setItemsCount(() => files.length);
  };

  const handleFinish = (id: string) => {
    setUploadMap((prev) => {
      const newMap = { ...prev };
      delete newMap[id];
      return newMap;
    });

    setUploadedCount((prev) => prev + 1);
  };

  const handleError = (uploadId: string) => {
    setFailedItems((prev) => [...prev, uploadMap[uploadId]]);
  };

  const handleDelete = (uploadId: string) => {
    setUploadMap((prev) => {
      const newMap = { ...prev };
      delete newMap[uploadId];
      return newMap;
    });

    setFailedItems((prev) => prev.filter((e) => e.uploadId !== uploadId));
  };

  const handleUpload = async <Record extends Entity = Entity>(
    createCallback: (items: StorageUploadItem[]) => Promise<Record[]>,
    field: keyof Record = 'id',
    batchSize = 10,
  ): Promise<boolean> => {
    setIsUploading(() => true);
    let isSuccess = true;

    try {
      const ids = Object.keys(uploadMap);

      setUploadedCount(() => 0);
      setItemsCount(() => ids.length);
      setFailedItems(() => []);

      for (let i = 0; i < ids.length; i += batchSize) {
        const startIndex = i;
        const endIndex = i + batchSize;

        const batchIds = ids.slice(startIndex, endIndex);

        const parsedData = batchIds.reduce(
          (
            acc: { batch: StorageUploadItem[]; createItems: StorageUploadItem[] },
            uploadId: string,
          ) => {
            const uploadItem = uploadMap[uploadId];

            acc.batch.push(uploadItem);

            if (!uploadItem.entityId) {
              acc.createItems.push(uploadItem);
            }

            return acc;
          },
          { batch: [], createItems: [] },
        );

        const entityIdByUploadId = new Map<string, string>();

        if (parsedData.createItems.length) {
          const entities = await createCallback(parsedData.batch);

          setUploadMap((prev) => {
            const newValues = entities.reduce(
              (acc: StorageUploadMap, entity) => {
                acc[entity.uploadId] = {
                  ...prev[entity.uploadId],
                  entityId: entity[field]?.toString(),
                };

                return acc;
              },
              { ...prev },
            );

            return {
              ...prev,
              ...newValues,
            };
          });

          entities.forEach((entity) => {
            entityIdByUploadId.set(entity.uploadId, entity[field]!.toString());
          });
        }

        for (const uploadItem of parsedData.batch) {
          const file = uploadItem.file;
          const entityId = uploadItem.entityId ?? entityIdByUploadId.get(uploadItem.uploadId);

          if (!entityId) {
            throw new Error(`File ${file.name} not found`);
          }

          const formData = new FormData();
          formData.append('file', file);

          try {
            await internalHttpClient.post(`${resource}/${entityId}/upload`, formData, {
              timeout: 0,
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            });

            handleFinish(uploadItem.uploadId);
          } catch (err) {
            open?.({
              type: 'error',
              message: `Upload error: ${uploadItem.file.name}`,
              description: getErrorMessage(err),
              key: `${resource}-upload-error-${Date.now()}`,
            });

            handleError(uploadItem.uploadId);
            isSuccess = false;
          }
        }
      }

      setIsUploading(() => false);
      return isSuccess;
    } catch (error) {
      open?.({
        type: 'error',
        message: 'Upload error',
        description: getErrorMessage(error),
        key: `${resource}-upload-error-${Date.now()}`,
      });

      setIsUploading(() => false);
      return false;
    }
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
