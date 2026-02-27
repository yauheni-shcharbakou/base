'use client';

import { internalHttpClient } from '@/common/clients';
import { getErrorMessage } from '@/common/helpers';
import { GrpcFileCreate, GrpcIdField } from '@packages/grpc';
import { BaseRecord, useNotification } from '@refinedev/core';
import { useState } from 'react';

type Params = {
  resource: string;
};

export const useFileUpload = ({ resource }: Params) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const handleUpload = async <UploadResponse extends BaseRecord = BaseRecord>(
    file: File,
    createFactory: (fileMetadata: GrpcFileCreate) => Promise<GrpcIdField>,
  ): Promise<UploadResponse | undefined> => {
    setIsUploading(() => true);
    setProgress(() => 0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { id } = await createFactory({
        originalName: file.name,
        size: file.size || 0,
        mimeType: file.type,
      });

      const response = await internalHttpClient.post<UploadResponse>(
        `${resource}/${id}/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || file.size;
            const current = progressEvent.loaded;
            const percentCompleted = (current * 100) / total;

            setProgress(() => percentCompleted);
          },
          timeout: 0,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );

      return response.data;
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
