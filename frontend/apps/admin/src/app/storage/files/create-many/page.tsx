'use client';

import { UploadManyPage } from '@/features/storage/components';
import { UPLOAD_RULES, uploadViaPresignedUrl } from '@/features/storage/helpers';
import { CreatedFile, fileActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';

export default function FileCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.FILE}
      batchSize={10}
      createManyAction={async (filesBatch, form) => {
        return fileActionProvider.createMany(form.userId, filesBatch, {
          parent: form.parent,
          isPublic: form.isPublic,
        });
      }}
      uploadFileAction={(file, entity) => {
        const { id, upload } = entity as CreatedFile;
        return uploadViaPresignedUrl(file, upload, id);
      }}
      uploaderProps={{
        dropzoneProps: {
          maxSize: UPLOAD_RULES.FILE.maxSize,
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
