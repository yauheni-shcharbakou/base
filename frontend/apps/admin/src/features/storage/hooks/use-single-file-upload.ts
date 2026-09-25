'use client';

import { getErrorMessage } from '@/common/helpers';
import { UploadFileAction } from '@/features/storage/types';
import { BaseRecord, useNotification } from '@refinedev/core';
import { useCallback, useState } from 'react';

type Params = {
  resource: string;
  // How the bytes leave the browser, with the credentials the created entity carries. See
  // `UploadFileAction` for why it carries the `Action` suffix.
  uploadFileAction: UploadFileAction;
};

export const useSingleFileUpload = ({ resource, uploadFileAction }: Params) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { open } = useNotification();

  const handleUpload = useCallback(
    async <Record extends BaseRecord = BaseRecord>(
      file: File,
      createCallback: () => Promise<Record>,
    ): Promise<Record | undefined> => {
      setIsUploading(() => true);
      setProgress(() => 0);

      try {
        const entity = await createCallback();
        const onProgress = (percent: number) => setProgress(() => percent);

        await uploadFileAction(file, entity, { onProgress });

        return entity;
      } catch (error) {
        open?.({
          type: 'error',
          message: 'Upload error',
          description: getErrorMessage(error),
          key: `${resource}-upload-error-${Date.now()}`,
        });

        return;
      } finally {
        setIsUploading(() => false);
      }
    },
    [resource, uploadFileAction, open],
  );

  return {
    progress,
    isUploading,
    handleUpload,
  };
};
