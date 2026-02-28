'use client';

import { internalHttpClient } from '@/common/clients';
import { getErrorMessage } from '@/common/helpers';
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
    formData: FormData,
  ): Promise<UploadResponse | undefined> => {
    setIsUploading(() => true);
    setProgress(() => 0);

    formData.append('file.name', file.name);
    formData.append('file.size', file.size.toString());
    formData.append('file.type', file.type);
    formData.append('file', file);

    try {
      const response = await internalHttpClient.post<UploadResponse>(
        `${resource}/upload`,
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
