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
import { usePresetPlacement, useSingleFileUpload } from '@/features/storage/hooks';
import {
  storageMetaSchema,
  toDropzoneAccept,
  UPLOAD_RULES,
  uploadViaPresignedUrl,
} from '@/features/storage/helpers';
import { CreatedImage, imageActionProvider } from '@/features/storage/providers';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import type { BrowserAuth } from '@packages/proto';
import { useGetIdentity } from '@refinedev/core';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  ...storageMetaSchema,
  name: zod.string().optional(),
  file: zod.file(),
  alt: zod.string(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function ImageCreate() {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

  const { isUploading, progress, handleUpload } = useSingleFileUpload({
    resource: StorageDatabaseEntity.FILE,
    // Straight from the browser to Bunny Storage; the image's bytes belong to its file row, so the
    // upload is confirmed by `fileId`.
    uploadFileAction: (file, entity, options) => {
      const { fileId, upload } = entity as CreatedImage;
      return uploadViaPresignedUrl(file, upload, fileId, options);
    },
  });

  const {
    watch,
    getValues,
    formState: { errors, isValid },
    control,
    setValue,
    refineCore: { onFinish, formLoading },
    handleSubmit,
  } = useValidatedForm(schema);

  const parent = watch('parent');
  const userId = watch('userId');
  const { presetUserId } = usePresetPlacement(userId, (id) => setValue('parent', id));
  const file = watch('file');

  const handleFileChange = (selectedFile?: File) => {
    if (!getValues('name')?.trim()) {
      setValue('name', selectedFile?.name ?? '');
    }
  };

  const handleSave = async (data: Params) => {
    const createdImage = await handleUpload<CreatedImage>(data.file, async () => {
      return imageActionProvider.createOne(
        data.userId,
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
    });

    if (createdImage) {
      // The signed URL is spent by now — it has no business in Refine's record.
      const { upload, ...image } = createdImage;
      await onFinish(image as any);
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
              maxSize: UPLOAD_RULES.IMAGE.maxSize,
              accept: toDropzoneAccept(UPLOAD_RULES.IMAGE.mimeTypes),
            }}
            fieldErr={errors?.file}
            selected={file}
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
