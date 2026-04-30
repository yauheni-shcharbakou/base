'use client';

import { AppCreate, ControlledTextField } from '@/common/components';
import { ONE_MB_BYTES } from '@/common/constants';
import { useValidatedForm } from '@/common/hooks';
import { imageActionProvider } from '@/features/storage/providers';
import {
  StorageUploader,
  SingleUploadProgressBar,
  StorageObjectMetaFormSection,
} from '@/features/storage/components';
import { useSingleFileUpload } from '@/features/storage/hooks';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import React from 'react';
import zod from 'zod';
import type { BrowserStorage } from '@packages/proto';

const schema = {
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  file: zod.file(),
  alt: zod.string(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function ImageCreate() {
  const { isUploading, progress, handleUpload } = useSingleFileUpload({
    resource: StorageDatabaseEntity.FILE,
  });

  const {
    watch,
    formState: { errors, isValid },
    control,
    setValue,
    refineCore: { onFinish, formLoading },
    handleSubmit,
  } = useValidatedForm(schema);

  const fields = watch();

  const handleFileChange = (file?: File) => {
    if (!fields.name?.trim()) {
      setValue('name', file?.name ?? '');
    }
  };

  const handleSave = async (data: Params) => {
    const createdImage = await handleUpload<BrowserStorage.Image>(
      data.file,
      async () => {
        return imageActionProvider.createOne(
          {
            file: data.file,
            alt: data.alt,
          },
          {
            parent: data.parent,
            name: data.name,
            isPublic: data.isPublic,
          },
        );
      },
      'fileId',
    );

    if (createdImage) {
      await onFinish(createdImage as any);
    }
  };

  return (
    <AppCreate
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: formLoading || !isValid || isUploading,
      }}
      isLoading={formLoading}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack gap={2}>
          <StorageObjectMetaFormSection parent={fields.parent} control={control} errors={errors} />

          <Card variant="outlined">
            <CardHeader title="Image metadata" />
            <CardContent>
              <ControlledTextField
                control={control}
                fieldName="alt"
                fieldErr={errors?.alt}
                label="Alt"
                defaultValue={'Image'}
                required
              />
            </CardContent>
          </Card>

          <StorageUploader
            control={control}
            fieldName="file"
            dropzoneProps={{
              maxSize: 100 * ONE_MB_BYTES,
              accept: {
                'image/jpeg': [],
                'image/png': [],
                'image/webp': [],
                'image/gif': [],
                'image/svg+xml': [],
              },
            }}
            fieldErr={errors?.file}
            selected={fields.file}
            isUploading={isUploading}
            onChange={handleFileChange}
            required
            multi={false}
            maxFiles={1}
            allowedTypes={['jpeg', 'png', 'jpg', 'webp', 'gif', 'svg']}
          >
            <SingleUploadProgressBar isUploading={isUploading} progress={progress} />
          </StorageUploader>
        </Stack>
      </Box>
    </AppCreate>
  );
}
