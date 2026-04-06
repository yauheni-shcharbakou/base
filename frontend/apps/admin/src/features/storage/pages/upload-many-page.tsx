'use client';

import { ControlledBooleanField, ControlledSingleSelect } from '@/common/components';
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
import React, { useCallback, useMemo } from 'react';
import zod from 'zod';

const schema = {
  parent: zod.string().optional(),
  isPublic: zod.boolean().optional(),
  files: zod.array(zod.file()),
  batchSize: zod.number().min(1).max(100),
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
  const {
    isUploading,
    uploadedCount,
    itemsCount,
    failedItems,
    handleUpload,
    handleDelete,
    addFiles,
  } = useMultipleFileUpload({ resource: props.fileResource });

  const onDelete = useCallback(handleDelete, []);
  const batchSizeOptions = useMemo(() => [1, 5, 10, 20, 100], []);

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
      data.batchSize,
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

          {itemsCount && (
            <ControlledSingleSelect
              control={control}
              formField="batchSize"
              fieldError={errors?.batchSize}
              options={batchSizeOptions}
              defaultValue={props.batchSize}
              label="Batch size"
              required
            />
          )}

          <MultipleFileUploader
            formField="files"
            errors={errors}
            control={control}
            watch={watch}
            isUploading={isUploading}
            required
            onDelete={onDelete}
            onChange={addFiles}
            uploadedCount={uploadedCount}
            itemsCount={itemsCount}
            failedItems={failedItems}
            {...(props.uploaderProps ?? {})}
          />
        </Stack>
      </Box>
    </Create>
  );
};
