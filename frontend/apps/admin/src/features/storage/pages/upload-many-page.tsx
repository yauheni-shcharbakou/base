'use client';

import { ControlledBooleanField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import {
  FolderSelect,
  MultipleFileUploader,
  MultipleFileUploaderProps,
} from '@/features/storage/components';
import { FileUploadItem, useMultipleFileUpload } from '@/features/storage/hooks';
import { Box, Card, CardContent, CardHeader, Stack, Typography } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { GrpcIdField } from '@packages/grpc';
import { useInvalidate, useNavigation } from '@refinedev/core';
import { Create } from '@refinedev/mui';
import React, { useCallback } from 'react';
import zod from 'zod';

const schema = {
  parent: zod.string().optional(),
  isPublic: zod.boolean().optional(),
  files: zod.array(zod.file()),
};

type Params = SchemaTypeOf<typeof schema>;

type Props<Entity extends GrpcIdField & { uploadId: string }> = {
  fileResource: string;
  resource: string;
  batchSize: number;
  uploaderProps?: Pick<MultipleFileUploaderProps, 'max' | 'maxSize' | 'accept' | 'allowedTypes'>;
  createFactory: (uploadItemsBatch: FileUploadItem[], form: Params) => Promise<Entity[]>;
  fileRefField?: keyof Entity | string;
};

export const UploadManyPage = <Entity extends GrpcIdField & { uploadId: string }>(
  props: Props<Entity>,
) => {
  const { isUploading, uploadMap, handleUpload, retryUpload, addFiles } = useMultipleFileUpload({
    resource: props.fileResource,
    batchSize: props.batchSize,
  });

  const onRetry = useCallback(retryUpload, []);

  const {
    watch,
    formState: { errors, isValid },
    control,
    refineCore: { formLoading },
    handleSubmit,
  } = useValidatedForm(schema);

  const invalidate = useInvalidate();

  const { list } = useNavigation();

  const parent = watch('parent');

  const handleSave = async (data: Params) => {
    const isSuccess = await handleUpload<Entity>(
      async (batch) => props.createFactory(batch, data),
      props.fileRefField as keyof Entity,
    );

    if (isSuccess) {
      await invalidate({ resource: props.resource, invalidates: ['list'] });
      list(props.resource);
    }
  };

  return (
    <Create
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: formLoading || !isValid || isUploading,
      }}
      isLoading={formLoading}
      title={<Typography variant="h5">Create many {props.resource}</Typography>}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack gap={2}>
          <Card variant="outlined">
            <CardHeader title="Storage" />
            <CardContent>
              <FolderSelect label="Folder" formField="parent" errors={errors} control={control} />
              {parent && (
                <ControlledBooleanField control={control} formField="isPublic" label="Public" />
              )}
            </CardContent>
          </Card>

          <MultipleFileUploader
            formField="files"
            errors={errors}
            control={control}
            watch={watch}
            isUploading={isUploading}
            required
            uploadMap={uploadMap}
            onRetry={onRetry}
            onChange={addFiles}
            {...(props.uploaderProps ?? {})}
          />
        </Stack>
      </Box>
    </Create>
  );
};
