'use client';

import { ONE_GB_BYTES } from '@/common/constants';
import { videoActionProvider } from '@/features/storage/providers';
import { UploadManyPage } from '@/features/storage/components';
import { StorageDatabaseEntity } from '@packages/common';
import React from 'react';

export default function VideoCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.VIDEO}
      fileResource={StorageDatabaseEntity.VIDEO}
      batchSize={1}
      createFactory={async (filesBatch, form) => {
        return videoActionProvider.createMany(filesBatch, {
          parent: form.parent,
          isPublic: form.isPublic,
        });
      }}
      uploaderProps={{
        dropzoneProps: {
          maxSize: 2 * ONE_GB_BYTES,
          accept: {
            'video/mp4': [],
            'video/quicktime': [],
            'video/webm': [],
          },
        },
        maxFiles: 100,
        allowedTypes: ['mp4', 'quicktime', 'webm'],
      }}
    />
  );
}
