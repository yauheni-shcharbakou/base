'use client';

import {
  AppCreate,
  ControlledBooleanField,
  ControlledSingleSelect,
  ControlledTextField,
} from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { folderActionProvider } from '@/features/storage/providers';
import { FolderSelect } from '@/features/storage/components';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { GrpcStorageObjectType } from '@packages/grpc';
import React from 'react';
import zod from 'zod';

const schema = {
  parent: zod.string().nonempty(),
  name: zod.string().nonempty(),
  isPublic: zod.boolean(),
  type: zod.enum(Object.values(GrpcStorageObjectType)),
};

type Params = SchemaTypeOf<typeof schema>;

export default function StorageObjectCreate() {
  const {
    formState: { errors },
    control,
    refineCore: { formLoading, onFinish },
    setError,
    clearErrors,
    handleSubmit,
  } = useValidatedForm(schema);

  const handleSave = async (data: Params) => {
    if (data.type === GrpcStorageObjectType.FOLDER) {
      const hasFolderWithSameName = await folderActionProvider.isExistsFolder({
        parent: data.parent,
        name: data.name,
      });

      if (hasFolderWithSameName) {
        setError('name', { type: 'manual', message: 'Choose another name for folder' });
        return;
      }
    }

    clearErrors('name');
    await onFinish(data);
  };

  return (
    <AppCreate
      saveButtonProps={{ onClick: handleSubmit(handleSave), disabled: formLoading }}
      isLoading={formLoading}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <FolderSelect
          label="Folder"
          fieldName="parent"
          fieldErr={errors?.parent}
          control={control}
          required
        />
        <ControlledTextField
          control={control}
          fieldName="name"
          fieldErr={errors?.name}
          label="Name"
          required
        />
        <ControlledBooleanField control={control} fieldName="isPublic" label="Public" />
        <ControlledSingleSelect
          control={control}
          fieldName="type"
          defaultValue={GrpcStorageObjectType.FOLDER}
          label="Type"
          options={[GrpcStorageObjectType.FOLDER] /*Object.values(GrpcStorageObjectType) */}
          required
        />
      </Box>
    </AppCreate>
  );
}
