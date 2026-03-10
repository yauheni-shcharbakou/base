'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { ONE_GB_BYTES } from '@/common/constants';
import { FileUploader, FolderSelect } from '@/features/file/components';
import { useFileUpload } from '@/features/file/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcUser } from '@packages/grpc';
import { HttpError, useGetIdentity } from '@refinedev/core';
import React from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import zod, { z } from 'zod';

const schema = zod.object({
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  title: zod.string().optional(),
  description: zod.string().optional(),
  file: zod.file(),
});

type Params = z.infer<typeof schema>;

export default function VideoCreate() {
  const { isUploading, progress, handleUpload } = useFileUpload({
    resource: StorageDatabaseEntity.VIDEO,
  });

  const { data: user } = useGetIdentity<GrpcUser>();

  const {
    formState: { errors, isValid },
    control,
    setValue,
    refineCore: { onFinish, formLoading },
    handleSubmit,
    watch,
  } = useForm<Params, HttpError, Params>({
    resolver: zodResolver(schema),
  });

  const handleFileChange = (file?: File) => {
    const fileName = file?.name ?? '';

    setValue('name', fileName);
    setValue('title', fileName.replace(/.\w+$/g, ''));
  };

  const handleSave = async (data: Params) => {
    const file = data.file;

    if (!file) {
      return;
    }

    const formData = new FormData();

    formData.append('video.title', data.title || '');
    formData.append('video.description', data.description || '');

    if (data.parent) {
      formData.append('storage.name', data.name || '');
      formData.append('storage.isPublic', data.isPublic ? 'true' : 'false');
      formData.append('storage.parent', data.parent);
    }

    const createdVideo = await handleUpload<any>(file, formData);

    if (!createdVideo) {
      return;
    }

    await onFinish(createdVideo);
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
            <CardHeader title="Video metadata" />
            <CardContent>
              <ControlledTextField
                control={control}
                formField="title"
                fieldError={errors?.title}
                label="Title"
              />
              <ControlledTextField
                control={control}
                formField="description"
                fieldError={errors?.description}
                label="Description"
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
            maxSize={2 * ONE_GB_BYTES}
            accept={{
              'video/mp4': [],
              'video/quicktime': [],
              'video/webm': [],
            }}
            allowedTypes={['mp4', 'quicktime', 'webm']}
          />
        </Stack>
      </Box>
    </Create>
  );
}
