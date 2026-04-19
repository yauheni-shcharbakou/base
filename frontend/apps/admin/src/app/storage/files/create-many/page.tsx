'use client';

import { ONE_MB_BYTES } from '@/common/constants';
import { fileActionProvider } from '@/features/storage/providers';
import { UploadManyPage } from '@/features/storage/components';
import { StorageDatabaseEntity } from '@packages/common';
import React from 'react';

export default function FileCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.FILE}
      fileResource={StorageDatabaseEntity.FILE}
      batchSize={10}
      createFactory={async (filesBatch, form) => {
        return fileActionProvider.createMany(filesBatch, {
          parent: form.parent,
          isPublic: form.isPublic,
        });
      }}
      uploaderProps={{
        dropzoneProps: {
          maxSize: 100 * ONE_MB_BYTES,
          accept: {
            'application/pdf': [],
          },
        },
        maxFiles: 100,
        allowedTypes: ['pdf'],
      }}
    />
  );
}
