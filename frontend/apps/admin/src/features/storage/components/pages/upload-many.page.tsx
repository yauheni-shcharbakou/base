'use client';

import { AppCreate, ControlledSingleSelect } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import {
  MultiUploadProgressBar,
  StorageUploader,
  FailedItemsList,
  StorageUploaderProps,
  StorageObjectMetaFormSection,
} from '@/features/storage/components';
import { useMultipleFileUpload } from '@/features/storage/hooks';
import { StorageUploadItem } from '@/features/storage/types';
import { Box, Stack, Typography } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { GrpcIdField } from '@packages/grpc';
import { useInvalidate, useNavigation } from '@refinedev/core';
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
  uploaderProps?: Pick<StorageUploaderProps, 'dropzoneProps' | 'maxFiles' | 'allowedTypes'>;
  createFactory: (uploadItemsBatch: StorageUploadItem[], form: Params) => Promise<Entity[]>;
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

  const batchSizeOptions = useMemo(() => {
    const options = [1, 5, 10, 20, 100];

    if (!itemsCount) {
      return options;
    }

    const calculatedOptions = options.filter((option) => option <= itemsCount);

    if (!options.includes(itemsCount)) {
      calculatedOptions.push(itemsCount);
    }

    return calculatedOptions;
  }, [itemsCount]);

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
  const selectedFiles = watch('files');

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
    <AppCreate
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: formLoading || !isValid || isUploading,
      }}
      isLoading={formLoading}
      title={<Typography variant="h5">Create many {props.resource}</Typography>}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack gap={2}>
          <StorageObjectMetaFormSection
            parent={parent}
            control={control}
            errors={errors}
            excludeName
          />

          {!!itemsCount && (
            <ControlledSingleSelect
              control={control}
              fieldName="batchSize"
              fieldErr={errors?.batchSize}
              options={batchSizeOptions}
              defaultValue={itemsCount >= props.batchSize ? props.batchSize : 1}
              label="Batch size"
              required
            />
          )}

          <StorageUploader
            control={control}
            fieldName="files"
            fieldErr={errors?.files}
            selected={selectedFiles}
            multi
            isUploading={isUploading}
            onChange={addFiles}
            required
            {...(props.uploaderProps ?? {})}
          >
            <MultiUploadProgressBar
              isUploading={isUploading}
              uploadedCount={uploadedCount}
              itemsCount={itemsCount}
            />
            <FailedItemsList
              failedItems={failedItems}
              isUploading={isUploading}
              onDelete={onDelete}
            />
          </StorageUploader>
        </Stack>
      </Box>
    </AppCreate>
  );
};
