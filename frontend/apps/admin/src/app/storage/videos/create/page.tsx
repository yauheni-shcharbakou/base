'use client';

import { AppCreate, ControlledTextField } from '@/common/components';
import { ONE_GB_BYTES } from '@/common/constants';
import { useValidatedForm } from '@/common/hooks';
import { FieldErr } from '@/common/types';
import { UserSelect } from '@/features/auth/components';
import {
  SingleUploadProgressBar,
  StorageObjectMetaFormSection,
  StorageUploader,
} from '@/features/storage/components';
import { useSingleFileUpload } from '@/features/storage/hooks';
import { videoActionProvider } from '@/features/storage/providers';
import { getGenericVideTitle } from '@/features/video/helpers';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import type { BrowserAuth, BrowserStorage } from '@packages/proto';
import { useGetIdentity } from '@refinedev/core';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  title: zod.string(),
  description: zod.string().optional(),
  file: zod.file(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function VideoCreate() {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

  const { isUploading, progress, handleUpload } = useSingleFileUpload({
    resource: StorageDatabaseEntity.VIDEO,
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
    const createdVideo = await handleUpload<BrowserStorage.Video>(data.file, async () => {
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
      await onFinish(createdVideo as any);
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
            defaultValue={user?.id}
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
              maxSize: 2 * ONE_GB_BYTES,
              accept: {
                'video/mp4': [],
                'video/quicktime': [],
                'video/webm': [],
              },
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
