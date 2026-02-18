'use client';

import { getErrorMessage } from '@/helpers/error.helpers';
import { internalHttpClient } from '@/helpers/http.helpers';
import { BaseRecord, useNotification } from '@refinedev/core';
import { useState } from 'react';

type Params = {
  resource: string;
};

type FormParams = Record<string, string | number | boolean | null | undefined>;

export const useUpload = ({ resource }: Params) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const handleUpload = async <UploadResponse extends BaseRecord = BaseRecord>(
    file: File,
    additionalParams: FormParams = {},
  ): Promise<UploadResponse | undefined> => {
    setIsUploading(() => true);
    setProgress(() => 0);

    const formData = Object.entries(additionalParams).reduce((acc, [key, value]) => {
      if (typeof value === 'boolean') {
        acc.append(key, value ? 'true' : 'false');
        return acc;
      }

      if (value || typeof value === 'number') {
        acc.append(key, value.toString());
      }

      return acc;
    }, new FormData());

    formData.append('file.mimeType', file.type);
    formData.append('file.originalName', file.name);
    formData.append('file.size', file.size.toString());
    formData.append('file', file);

    try {
      const response = await internalHttpClient.post<UploadResponse>(
        `${resource}/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || file.size;
            const current = progressEvent.loaded;
            const percentCompleted = Math.round((current * 100) / total);

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
