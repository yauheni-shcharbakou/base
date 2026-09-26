'use client';

import { ONE_GB_BYTES } from '@/common/constants';
import { UploadManyPage } from '@/features/storage/components';
import { videoActionProvider, type CreatedVideo } from '@/features/storage/providers';
import { uploadViaTus } from '@/features/video/helpers';
import { StorageDatabaseEntity } from '@packages/common';

export default function VideoCreateMany() {
  return (
    <UploadManyPage
      resource={StorageDatabaseEntity.VIDEO}
      batchSize={1}
      createManyAction={async (filesBatch, form) => {
        return videoActionProvider.createMany(form.userId, filesBatch, {
          parent: form.parent,
          isPublic: form.isPublic,
        });
      }}
      // Straight from the browser to Bunny — nothing passes through the Next server.
      uploadFileAction={(file, entity) => uploadViaTus(file, (entity as CreatedVideo).upload)}
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
