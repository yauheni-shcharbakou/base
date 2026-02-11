'use client';

import { getErrorMessage } from '@/helpers/error.helpers';
import { internalHttpClient } from '@/helpers/http.helpers';
import { CreateResponse, UpdateResponse, useNotification } from '@refinedev/core';
import { useState } from 'react';

type Params = {
  resource: string;
};

export const useUpload = ({ resource }: Params) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const handleUpload = async <UploadResponse = any>(
    formData: FormData,
    file?: File,
    onSuccess?: (
      data: UploadResponse,
    ) => Promise<CreateResponse<any> | UpdateResponse<any> | void> | void,
  ) => {
    if (!file) {
      return;
    }

    setIsUploading(() => true);
    setProgress(() => 0);

    try {
      const response = await internalHttpClient.post(`${resource}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const current = progressEvent.loaded;
          const percentCompleted = Math.round((current * 100) / total);

          setProgress(() => percentCompleted);
        },
      });

      await onSuccess?.(response.data);
    } catch (error) {
      open?.({
        type: 'error',
        message: 'Upload error',
        description: getErrorMessage(error),
        key: `${resource}-upload-error`,
      });

      setIsUploading(() => false);
    }
  };

  return {
    progress,
    isUploading,
    handleUpload,
  };
};
