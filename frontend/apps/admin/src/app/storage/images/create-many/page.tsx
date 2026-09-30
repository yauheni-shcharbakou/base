'use client';

import { UploadManyPage } from '@/features/storage/components';
import { toDropzoneAccept, UPLOAD_RULES, uploadViaPresignedUrl } from '@/features/storage/helpers';
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
          maxSize: UPLOAD_RULES.IMAGE.maxSize,
          accept: toDropzoneAccept(UPLOAD_RULES.IMAGE.mimeTypes),
        },
        maxFiles: 100,
        allowedTypes: ['jpeg', 'png', 'jpg', 'webp', 'gif', 'svg'],
      }}
    />
  );
}
