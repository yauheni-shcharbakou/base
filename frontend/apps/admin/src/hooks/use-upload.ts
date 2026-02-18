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

    const formData = new FormData();

    for (const key in additionalParams) {
      const value = additionalParams[key];

      if (typeof value === 'boolean') {
        formData.append(key, value ? 'true' : 'false');
        continue;
      }

      if (!value) {
        continue;
      }

      formData.append(key, value.toString());
    }

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
