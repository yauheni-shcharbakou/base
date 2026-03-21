'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { ONE_MB_BYTES } from '@/common/constants';
import { storageActionClient } from '@/features/file/clients';
import { FileUploader, FolderSelect } from '@/features/file/components';
import { useFileUpload } from '@/features/file/hooks';
import { getImageDimensions } from '@/features/image/helpers';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcImage, GrpcUser } from '@packages/grpc';
import { HttpError, useGetIdentity } from '@refinedev/core';
import React from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import zod, { z } from 'zod';

const schema = zod.object({
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  file: zod.file(),
  alt: zod.string(),
});

type Params = z.infer<typeof schema>;

export default function ImageCreate() {
  const { isUploading, progress, handleUpload } = useFileUpload({
    resource: StorageDatabaseEntity.FILE,
  });

  const { data: user } = useGetIdentity<GrpcUser>();

  const {
    watch,
    formState: { errors, isValid },
    control,
    setValue,
    refineCore: { onFinish, formLoading },
    handleSubmit,
  } = useForm<Params, HttpError, Params>({
    resolver: zodResolver(schema),
  });

  const handleFileChange = (file?: File) => {
    setValue('name', file?.name ?? '');
  };

  const handleSave = async (data: Params) => {
    const createdImage = await handleUpload<GrpcImage>(
      data.file,
      async (fileData) => {
        const dimensions = await getImageDimensions(data.file);

        return storageActionClient.createImage(
          {
            file: fileData,
            image: { ...dimensions, alt: data.alt },
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
              <FolderSelect
                label="Folder"
                formField="parent"
                errors={errors}
                control={control}
                userId={user?.id}
              />
              <ControlledTextField
                control={control}
                formField="name"
                fieldError={errors?.name}
                label="Name"
              />
              <ControlledBooleanField control={control} formField="isPublic" label="Public" />
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

          <FileUploader
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
