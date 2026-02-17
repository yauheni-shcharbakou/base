'use client';

import { getErrorMessage } from '@/helpers/error.helpers';
import { BaseRecord, useNotification } from '@refinedev/core';
import { useState } from 'react';

type Params = {
  resource: string;
};

export const useUpload = ({ resource }: Params) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const handleUpload = async <UploadResponse extends BaseRecord = BaseRecord>(
    file: File,
    additionalParams: Record<string, string | number | boolean | undefined> = {},
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
      const response = await fetch(`/api/${resource}/upload`, {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let entity: UploadResponse | undefined;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const lines = decoder.decode(value).split('\n');

        lines.forEach((line) => {
          if (line) {
            const { type, value } = JSON.parse(line);

            if (type === 'percent') {
              setProgress(() => value);
              return;
            }

            if (type === 'entity') {
              entity = value;
            }
          }
        });
      }

      if (!entity) {
        throw new Error('No response entity');
      }

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
