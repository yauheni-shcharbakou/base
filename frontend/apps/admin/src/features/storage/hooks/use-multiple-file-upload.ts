'use client';

import { internalHttpClient } from '@/common/clients';
import { getErrorMessage } from '@/common/helpers';
import { useNotification } from '@refinedev/core';
import { useState } from 'react';
import { monotonicFactory } from 'ulid';
import { GrpcIdField } from '@packages/grpc';

type Params = {
  resource: string;
  batchSize: number;
};

type Entity = GrpcIdField & { uploadId: string };

export type FileUploadItem = {
  file: File;
  progress: number;
  status: 'success' | 'error' | 'awaited' | 'in-process';
  id: string;
  entityId?: string;
};

export type FileUploadMap = {
  [id: string]: FileUploadItem;
};

export const useMultipleFileUpload = ({ resource, batchSize }: Params) => {
  const [uploadMap, setUploadMap] = useState<FileUploadMap>({});
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const addFiles = (files: File[] = []) => {
    if (!files.length) {
      setUploadMap(() => ({}));
      return;
    }

    setUploadMap((prev) => {
      return files.reduce(
        (acc: FileUploadMap, file) => {
          const id = monotonicFactory()();
          acc[id] = { file, status: 'awaited', progress: 0, id };
          return acc;
        },
        { ...prev },
      );
    });
  };

  const handleProgressChange = (id: string, progress: number) => {
    setUploadMap((prev) => {
      return {
        ...prev,
        [id]: { ...prev[id], progress },
      };
    });
  };

  const handleFinish = (id: string) => {
    setUploadMap((prev) => {
      return {
        ...prev,
        [id]: { ...prev[id], status: 'success' },
      };
    });
  };

  const handleError = (id: string) => {
    setUploadMap((prev) => {
      return {
        ...prev,
        [id]: { ...prev[id], status: 'error' },
      };
    });
  };

  const retryUpload = async (uploadItem: FileUploadItem) => {
    if (!uploadItem.entityId) {
      return;
    }

    setUploadMap((prev) => {
      return {
        ...prev,
        [uploadItem.id]: { ...prev[uploadItem.id], status: 'in-process' },
      };
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadItem.file);

      await internalHttpClient.post(`${resource}/${uploadItem.entityId}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || uploadItem.file.size;
          const current = progressEvent.loaded;
          const percentCompleted = (current * 100) / total;

          handleProgressChange(uploadItem.id, percentCompleted);
        },
        timeout: 0,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      handleFinish(uploadItem.id);
    } catch (err) {
      handleError(uploadItem.id);
    }
  };

  const handleUpload = async <Record extends Entity = Entity>(
    createCallback: (items: FileUploadItem[]) => Promise<Record[]>,
    field: keyof Record = 'id',
  ): Promise<boolean> => {
    setIsUploading(() => true);
    let isSuccess = true;

    try {
      const ids = Object.keys(uploadMap);

      for (let i = 0; i < ids.length; i += batchSize) {
        const startIndex = i;
        const endIndex = i + batchSize;

        const batchIds = ids.slice(startIndex, endIndex);
        const batch = batchIds.map((id) => uploadMap[id]);
        const entities = await createCallback(batch);

        setUploadMap((prev) => {
          const newValues = entities.reduce(
            (acc: FileUploadMap, entity) => {
              acc[entity.uploadId] = {
                ...prev[entity.uploadId],
                status: 'in-process',
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

        const entityIdByUploadId = new Map(
          entities.map((entity) => [entity.uploadId, entity[field]!.toString()]),
        );

        const successIds: string[] = [];

        for (const uploadItem of batch) {
          const file = uploadItem.file;
          const entityId = entityIdByUploadId.get(uploadItem.id);

          if (!entityId) {
            throw new Error(`File ${file.name} not found`);
          }

          const formData = new FormData();
          formData.append('file', file);

          try {
            await internalHttpClient.post(`${resource}/${entityId}/upload`, formData, {
              onUploadProgress: (progressEvent) => {
                const total = progressEvent.total || file.size;
                const current = progressEvent.loaded;
                const percentCompleted = (current * 100) / total;

                handleProgressChange(uploadItem.id, percentCompleted);
              },
              timeout: 0,
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            });

            handleFinish(uploadItem.id);
            successIds.push(uploadItem.id);
          } catch (err) {
            handleError(uploadItem.id);
            isSuccess = false;
          }
        }

        setUploadMap((prev) => {
          const newMap = { ...prev };

          successIds.forEach((id) => {
            delete newMap[id];
          });

          return newMap;
        });
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
    uploadMap,
    isUploading,
    handleUpload,
    retryUpload,
  };
};
