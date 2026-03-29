'use client';

import { ONE_GB_BYTES } from '@/common/constants';
import { videoActionClient } from '@/features/storage/clients';
import { UploadManyPage } from '@/features/storage/pages';
import { StorageDatabaseEntity } from '@packages/common';
import React from 'react';

export default function VideoCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.VIDEO}
      fileResource={StorageDatabaseEntity.VIDEO}
      batchSize={1}
      createFactory={async (filesBatch, form) => {
        return videoActionClient.createMany(
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
        maxSize: 2 * ONE_GB_BYTES,
        accept: {
          'video/mp4': [],
          'video/quicktime': [],
          'video/webm': [],
        },
        allowedTypes: ['mp4', 'quicktime', 'webm'],
        max: 100,
      }}
    />
  );
}
