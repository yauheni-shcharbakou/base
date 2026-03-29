'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { ONE_MB_BYTES } from '@/common/constants';
import { useValidatedForm } from '@/common/hooks';
import { fileActionClient } from '@/features/storage/clients';
import { SingleFileUploader, FolderSelect } from '@/features/storage/components';
import { useSingleFileUpload } from '@/features/storage/hooks';
import { Box, Card, CardContent, CardHeader, Stack } from '@mui/material';
import { SchemaTypeOf, StorageDatabaseEntity } from '@packages/common';
import { GrpcFile } from '@packages/grpc';
import { Create } from '@refinedev/mui';
import React from 'react';
import zod from 'zod';

const schema = {
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
  file: zod.file(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function FileCreate() {
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
    const createdFile = await handleUpload<GrpcFile>(data.file, async () => {
      return fileActionClient.createOne(data.file, {
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
              'application/pdf': [],
            }}
            allowedTypes={['pdf']}
          />
        </Stack>
      </Box>
    </Create>
  );
}
