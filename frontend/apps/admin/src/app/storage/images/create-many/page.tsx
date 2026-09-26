'use client';

import { ONE_MB_BYTES } from '@/common/constants';
import { UploadManyPage } from '@/features/storage/components';
import { uploadViaPresignedUrl } from '@/features/storage/helpers';
import { CreatedImage, imageActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';

export default function ImageCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.IMAGE}
      batchSize={10}
      createManyAction={async (filesBatch, form) => {
        return imageActionProvider.createMany(form.userId, filesBatch, {
          parent: form.parent,
          isPublic: form.isPublic,
        });
      }}
      uploadFileAction={(file, entity) => {
        const { fileId, upload } = entity as CreatedImage;
        return uploadViaPresignedUrl(file, upload, fileId);
      }}
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
