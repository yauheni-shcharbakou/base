'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { ONE_GB_BYTES } from '@/common/constants';
import { useValidatedForm } from '@/common/hooks';
import { videoActionClient } from '@/features/storage/clients';
import { SingleFileUploader, FolderSelect } from '@/features/storage/components';
import { useSingleFileUpload } from '@/features/storage/hooks';
import { getGenericVideTitle } from '@/features/video/helpers';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import { GrpcVideo } from '@packages/grpc';
import React from 'react';
import { Create } from '@refinedev/mui';
import zod from 'zod';

const schema = {
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  title: zod.string(),
  description: zod.string().optional(),
  file: zod.file(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function VideoCreate() {
  const { isUploading, progress, handleUpload } = useSingleFileUpload({
    resource: StorageDatabaseEntity.VIDEO,
  });

  const {
    formState: { errors, isValid },
    control,
    setValue,
    refineCore: { onFinish, formLoading },
    handleSubmit,
    watch,
  } = useValidatedForm(schema);

  const fields = watch();

  const handleFileChange = (file?: File) => {
    const fileName = file?.name ?? '';

    if (!fields.name?.trim()) {
      setValue('name', fileName);
    }

    if (!fields.title?.trim()) {
      setValue('title', getGenericVideTitle(fileName));
    }
  };

  const handleSave = async (data: Params) => {
    const createdVideo = await handleUpload<GrpcVideo>(data.file, async () => {
      return videoActionClient.createOne(
        {
          file: data.file,
          title: data.title,
          description: data.description,
        },
        {
          parent: data.parent,
          name: data.name,
          isPublic: data.isPublic,
        },
      );
    });

    if (createdVideo) {
      await onFinish(createdVideo as any);
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
              {fields.parent && (
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
            <CardHeader title="Video metadata" />
            <CardContent>
              <ControlledTextField
                control={control}
                formField="title"
                fieldError={errors?.title}
                label="Title"
                required
              />
              <ControlledTextField
                control={control}
                formField="description"
                fieldError={errors?.description}
                label="Description"
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
