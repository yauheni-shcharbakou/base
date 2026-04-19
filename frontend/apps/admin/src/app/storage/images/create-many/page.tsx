'use client';

import { ONE_MB_BYTES } from '@/common/constants';
import { imageActionProvider } from '@/features/storage/providers';
import { UploadManyPage } from '@/features/storage/components';
import { StorageDatabaseEntity } from '@packages/common';
import React from 'react';

export default function ImageCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.IMAGE}
      fileResource={StorageDatabaseEntity.FILE}
      batchSize={10}
      createFactory={async (filesBatch, form) => {
        return imageActionProvider.createMany(filesBatch, {
          parent: form.parent,
          isPublic: form.isPublic,
        });
      }}
      fileRefField="fileId"
      uploaderProps={{
        dropzoneProps: {
          maxSize: 100 * ONE_MB_BYTES,
          accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': [],
            'image/gif': [],
            'image/svg+xml': [],
          },
        },
        maxFiles: 100,
        allowedTypes: ['jpeg', 'png', 'jpg', 'webp', 'gif', 'svg'],
      }}
    />
  );
}
