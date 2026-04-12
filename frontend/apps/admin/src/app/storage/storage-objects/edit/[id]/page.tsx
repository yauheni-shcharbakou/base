'use client';

import { ControlledBooleanField, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { folderActionClient } from '@/features/storage/clients';
import { FolderSelect } from '@/features/storage/components';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { GrpcStorageObject } from '@packages/grpc';
import { Edit } from '@refinedev/mui';
import React, { useEffect } from 'react';
import zod from 'zod';

const schema = {
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function StorageObjectEdit() {
  const {
    formState: { errors },
    refineCore: { formLoading, query, onFinish },
    control,
    register,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
  } = useValidatedForm<typeof schema, GrpcStorageObject>(schema);

  useEffect(() => {
    if (formLoading) {
      setValue('parent', '');
    }
  }, [formLoading]);

  const entity = query?.data?.data;

  const handleSave = async (data: Params) => {
    const updateData: Params = {
      isPublic: data.isPublic,
    };

    const isNameChanged = !!data.name && data.name !== entity?.name;
    const isParentChanged = !!data.parent && data.parent !== entity?.parentId;
    const parent = data.parent || entity?.parentId;

    if (isNameChanged) {
      updateData.name = data.name;
    }

    if (isParentChanged) {
      updateData.parent = data.parent;
    }

    if (entity?.isFolder && isNameChanged && parent) {
      const hasFolderWithSameName = await folderActionClient.isExistsFolder({
        parent,
        name: data.name!,
      });

      if (hasFolderWithSameName) {
        setError('name', { type: 'manual', message: 'Choose another name for folder' });
        return;
      }
    }

    clearErrors('name');
    await onFinish(updateData);
  };

  return (
    <Edit
      isLoading={formLoading && !!entity}
      saveButtonProps={{ onClick: handleSubmit(handleSave), disabled: formLoading }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        {!formLoading && (
          <FolderSelect
            label="Folder"
            formField="parent"
            errors={errors}
            control={control}
            onOptionsLoaded={() => setValue('parent', entity?.parentId)}
            id={entity?.id}
          />
        )}
        <TextEditField
          register={register('name', { setValueAs: (value) => value || undefined })}
          label="Name"
          value={entity?.name}
          fieldError={errors?.name}
        />
        <ControlledBooleanField
          control={control}
          formField="isPublic"
          label="Public"
          defaultValue={entity?.isPublic}
        />
      </Box>
    </Edit>
  );
}
