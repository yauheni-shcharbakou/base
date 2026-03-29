'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { ONE_MB_BYTES } from '@/common/constants';
import { useValidatedForm } from '@/common/hooks';
import { imageActionClient } from '@/features/storage/clients';
import { SingleFileUploader, FolderSelect } from '@/features/storage/components';
import { useSingleFileUpload } from '@/features/storage/hooks';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import { GrpcImage } from '@packages/grpc';
import React from 'react';
import { Create } from '@refinedev/mui';
import zod from 'zod';

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

  const parent = watch('parent');
  const name = watch('name');

  const handleFileChange = (file?: File) => {
    if (!name?.trim()) {
      setValue('name', file?.name ?? '');
    }
  };

  const handleSave = async (data: Params) => {
    const createdImage = await handleUpload<GrpcImage>(
      data.file,
      async () => {
        return imageActionClient.createOne(
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
    <Create
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: formLoading || !isValid || isUploading,
      }}
      isLoading={formLoading}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack gap={2}>
          <Card variant="outlined">
            <CardHeader title="Storage" />
            <CardContent>
              <FolderSelect label="Folder" formField="parent" errors={errors} control={control} />
              {parent && (
                <>
                  <ControlledTextField
                    control={control}
                    formField="name"
                    fieldError={errors?.name}
                    label="Name"
                  />
                  <ControlledBooleanField control={control} formField="isPublic" label="Public" />
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Image metadata" />
            <CardContent>
              <ControlledTextField
                control={control}
                formField="alt"
                fieldError={errors?.alt}
                label="Alt"
                defaultValue={'Image'}
                required
              />
            </CardContent>
          </Card>

          <SingleFileUploader
            formField="file"
            errors={errors}
            control={control}
            watch={watch}
            progress={progress}
            isUploading={isUploading}
            onChange={handleFileChange}
            required
            maxSize={100 * ONE_MB_BYTES}
            accept={{
              'image/jpeg': [],
              'image/png': [],
              'image/webp': [],
              'image/gif': [],
              'image/svg+xml': [],
            }}
            allowedTypes={['jpeg', 'png', 'jpg', 'webp', 'gif', 'svg']}
          />
        </Stack>
      </Box>
    </Create>
  );
}
