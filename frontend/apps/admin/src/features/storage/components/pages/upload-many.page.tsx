'use client';

import { AppCreate, ControlledSingleSelect } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { FieldErr } from '@/common/types';
import { UserSelect } from '@/features/auth/components';
import {
  FailedItemsList,
  MultiUploadProgressBar,
  StorageObjectMetaFormSection,
  StorageUploader,
  StorageUploaderProps,
} from '@/features/storage/components';
import { useMultipleFileUpload } from '@/features/storage/hooks';
import { StorageUploadItem } from '@/features/storage/types';
import { Box, Stack, Typography } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { BrowserAuth, type BrowserCommon } from '@packages/proto';
import { useGetIdentity, useInvalidate, useNavigation } from '@refinedev/core';
import { useMemo } from 'react';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  parent: zod.string().optional(),
  isPublic: zod.boolean().optional(),
  files: zod.array(zod.file()),
  batchSize: zod.number().min(1).max(100),
};

type Params = SchemaTypeOf<typeof schema>;

type Props<Entity extends BrowserCommon.IdField & { uploadId: string }> = {
  fileResource: string;
  resource: string;
  batchSize: number;
  uploaderProps?: Pick<StorageUploaderProps, 'dropzoneProps' | 'maxFiles' | 'allowedTypes'>;
  // Named with the `Action` suffix so Next's `'use client'` serializable-props check (71007)
  // accepts this function prop. It runs on the client but orchestrates server actions
  // (`*ActionProvider.createMany`); both this component and its consumers are `'use client'`,
  // so passing it is safe.
  createManyAction: (uploadItemsBatch: StorageUploadItem[], form: Params) => Promise<Entity[]>;
  fileRefField?: keyof Entity | string;
};

export const UploadManyPage = <Entity extends BrowserCommon.IdField & { uploadId: string }>(
  props: Props<Entity>,
) => {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

  const {
    isUploading,
    uploadedCount,
    itemsCount,
    failedItems,
    handleUpload,
    handleDelete,
    addFiles,
  } = useMultipleFileUpload({ resource: props.fileResource });

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
    setValue,
  } = useValidatedForm(schema);

  const invalidate = useInvalidate();

  const { list } = useNavigation();

  const parent = watch('parent');
  const selectedFiles = watch('files');
  const userId = watch('userId');

  const handleSave = async (data: Params) => {
    const isSuccess = await handleUpload<Entity>(
      async (batch) => props.createManyAction(batch, data),
      props.fileRefField as keyof Entity,
      data.batchSize,
    );

    if (isSuccess) {
      await invalidate({ resource: props.resource, invalidates: ['list'] });
      list(props.resource);
    }
  };

  // useEffect(() => {
  //   if (user?.id) {
  //     setValue('userId', user.id);
  //   }
  // }, [setValue, user?.id]);

  return (
    <AppCreate
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: formLoading || !isValid || isUploading,
      }}
      isLoading={formLoading || !user}
      title={<Typography variant="h5">Create many {props.resource}</Typography>}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack gap={2}>
          {user && (
            <>
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
                excludeName
              />
            </>
          )}

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
              onDelete={handleDelete}
            />
          </StorageUploader>
        </Stack>
      </Box>
    </AppCreate>
  );
};
