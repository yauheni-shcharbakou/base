'use client';

import { internalHttpClient } from '@/common/clients';
import { getErrorMessage } from '@/common/helpers';
import { GrpcFileCreate } from '@packages/grpc';
import { BaseRecord, useNotification } from '@refinedev/core';
import { useState } from 'react';

type Params = {
  resource: string;
};

export const useFileUpload = ({ resource }: Params) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const handleUpload = async <Record extends BaseRecord = BaseRecord>(
    file: File,
    createCallback: (fileData: GrpcFileCreate) => Promise<Record>,
    field: keyof Record = 'id',
  ): Promise<Record | undefined> => {
    setIsUploading(() => true);
    setProgress(() => 0);

    try {
      const entity = await createCallback({
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      });

      const formData = new FormData();
      formData.append('file', file);

      await internalHttpClient.post(`${resource}/${entity[field]}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const current = progressEvent.loaded;
          const percentCompleted = (current * 100) / total;

          setProgress(() => percentCompleted);
        },
        timeout: 0,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return entity;
    } catch (error) {
      open?.({
        type: 'error',
        message: 'Upload error',
        description: getErrorMessage(error),
        key: `${resource}-upload-error-${Date.now()}`,
      });

      setIsUploading(() => false);
      return;
    }
  };

  return {
    progress,
    isUploading,
    handleUpload,
  };
};
