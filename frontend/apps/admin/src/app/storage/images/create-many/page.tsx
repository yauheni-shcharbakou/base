'use client';

import { ONE_MB_BYTES } from '@/common/constants';
import { imageActionClient } from '@/features/storage/clients';
import { UploadManyPage } from '@/features/storage/pages';
import { StorageDatabaseEntity } from '@packages/common';
import React from 'react';

export default function ImageCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.IMAGE}
      fileResource={StorageDatabaseEntity.FILE}
      batchSize={10}
      createFactory={async (filesBatch, form) => {
        return imageActionClient.createMany(
          filesBatch.map((item) => {
            return { file: item.file, uploadId: item.id };
          }),
          {
            parent: form.parent,
            isPublic: form.isPublic,
          },
        );
      }}
      fileRefField="fileId"
      uploaderProps={{
        maxSize: 100 * ONE_MB_BYTES,
        accept: {
          'image/jpeg': [],
          'image/png': [],
          'image/webp': [],
          'image/gif': [],
          'image/svg+xml': [],
        },
        allowedTypes: ['jpeg', 'png', 'jpg', 'webp', 'gif', 'svg'],
        max: 100,
      }}
    />
  );
}
