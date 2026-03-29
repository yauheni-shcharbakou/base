'use client';

import { ONE_MB_BYTES } from '@/common/constants';
import { fileActionClient } from '@/features/storage/clients';
import { UploadManyPage } from '@/features/storage/pages';
import { StorageDatabaseEntity } from '@packages/common';
import React from 'react';

export default function FileCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.FILE}
      fileResource={StorageDatabaseEntity.FILE}
      batchSize={10}
      createFactory={async (filesBatch, form) => {
        return fileActionClient.createMany(
          filesBatch.map((item) => {
            return { file: item.file, uploadId: item.id };
          }),
          {
            parent: form.parent,
            isPublic: form.isPublic,
          },
        );
      }}
      uploaderProps={{
        maxSize: 100 * ONE_MB_BYTES,
        accept: {
          'application/pdf': [],
        },
        allowedTypes: ['pdf'],
        max: 100,
      }}
    />
  );
}
