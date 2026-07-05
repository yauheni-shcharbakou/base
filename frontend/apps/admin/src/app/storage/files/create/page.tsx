'use client';

import { AppCreate } from '@/common/components';
import { ONE_MB_BYTES } from '@/common/constants';
import { useValidatedForm } from '@/common/hooks';
import {
  SingleUploadProgressBar,
  StorageObjectMetaFormSection,
  StorageUploader,
} from '@/features/storage/components';
import { useSingleFileUpload } from '@/features/storage/hooks';
import { fileActionProvider } from '@/features/storage/providers';
import { Box, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import type { BrowserAuth, BrowserStorage } from '@packages/proto';
import { useGetIdentity } from '@refinedev/core';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  file: zod.file(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function FileCreate() {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

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
    const createdFile = await handleUpload<BrowserStorage.File>(data.file, async () => {
      return fileActionProvider.createOne(fields.userId, data.file, {
        parent: data.parent,
        name: data.name,
        isPublic: data.isPublic,
      });
    });

    if (createdFile) {
      await onFinish(createdFile as any);
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
          <StorageObjectMetaFormSection
            parent={fields.parent}
            control={control}
            errors={errors}
            userId={fields.userId}
            currentUserId={user?.id}
          />

          <StorageUploader
            control={control}
            fieldName="file"
            dropzoneProps={{
              maxSize: 100 * ONE_MB_BYTES,
              accept: {
                'application/pdf': [],
              },
            }}
            fieldErr={errors?.file}
            selected={fields.file}
            isUploading={isUploading}
            onChange={handleFileChange}
            required
            multi={false}
            maxFiles={1}
            allowedTypes={['pdf']}
          >
            <SingleUploadProgressBar isUploading={isUploading} progress={progress} />
          </StorageUploader>
        </Stack>
      </Box>
    </AppCreate>
  );
}
