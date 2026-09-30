'use client';

import { AppCreate, ControlledTextField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { FieldErr } from '@/common/types';
import { UserSelect } from '@/features/auth/components';
import {
  SingleUploadProgressBar,
  StorageObjectMetaFormSection,
  StorageUploader,
} from '@/features/storage/components';
import { storageMetaSchema, toDropzoneAccept, UPLOAD_RULES } from '@/features/storage/helpers';
import { usePresetPlacement, useSingleFileUpload } from '@/features/storage/hooks';
import { videoActionProvider, type CreatedVideo } from '@/features/storage/providers';
import { getGenericVideTitle, uploadViaTus } from '@/features/video/helpers';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import type { BrowserAuth } from '@packages/proto';
import { useGetIdentity } from '@refinedev/core';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  ...storageMetaSchema,
  name: zod.string().optional(),
  title: zod.string(),
  description: zod.string().optional(),
  file: zod.file(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function VideoCreate() {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

  const { isUploading, progress, handleUpload } = useSingleFileUpload({
    resource: StorageDatabaseEntity.VIDEO,
    // Straight from the browser to Bunny — nothing passes through the Next server.
    uploadFileAction: (file, entity, options) =>
      uploadViaTus(file, (entity as CreatedVideo).upload, { onProgress: options?.onProgress }),
  });

  const {
    formState: { errors, isValid },
    control,
    setValue,
    getValues,
    refineCore: { onFinish, formLoading },
    handleSubmit,
    watch,
  } = useValidatedForm(schema);

  const parent = watch('parent');
  const userId = watch('userId');
  const { presetUserId } = usePresetPlacement(userId, (id) => setValue('parent', id));
  const file = watch('file');

  const handleFileChange = (selectedFile?: File) => {
    const fileName = selectedFile?.name ?? '';

    if (!getValues('name')?.trim()) {
      setValue('name', fileName);
    }

    if (!getValues('title')?.trim()) {
      setValue('title', getGenericVideTitle(fileName));
    }
  };

  const handleSave = async (data: Params) => {
    const createdVideo = await handleUpload<CreatedVideo>(data.file, async () => {
      return videoActionProvider.createOne(
        data.userId,
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
      // The TUS credentials are spent by now — they have no business in Refine's record.
      const { upload, ...video } = createdVideo;
      await onFinish(video as any);
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
          <UserSelect
            label="User"
            fieldName="userId"
            fieldErr={errors?.userId as FieldErr}
            control={control}
            defaultValue={presetUserId ?? user?.id}
            required
          />

          <StorageObjectMetaFormSection
            parent={parent}
            control={control}
            errors={errors}
            userId={userId}
          />

          <Card variant="outlined">
            <CardHeader title="Video metadata" />
            <CardContent>
              <ControlledTextField
                control={control}
                fieldName="title"
                fieldErr={errors?.title}
                label="Title"
                required
              />
              <ControlledTextField
                control={control}
                fieldName="description"
                fieldErr={errors?.description}
                label="Description"
              />
            </CardContent>
          </Card>

          <StorageUploader
            control={control}
            fieldName="file"
            dropzoneProps={{
              maxSize: UPLOAD_RULES.VIDEO.maxSize,
              accept: toDropzoneAccept(UPLOAD_RULES.VIDEO.mimeTypes),
            }}
            fieldErr={errors?.file}
            selected={file}
            isUploading={isUploading}
            onChange={handleFileChange}
            required
            multi={false}
            maxFiles={1}
            allowedTypes={['mp4', 'quicktime', 'webm']}
          >
            <SingleUploadProgressBar isUploading={isUploading} progress={progress} />
          </StorageUploader>
        </Stack>
      </Box>
    </AppCreate>
  );
}
