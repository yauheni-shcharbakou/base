'use client';

import {
  ControlledBooleanField,
  ControlledSingleSelect,
  ControlledTextField,
} from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { storageActionClient } from '@/features/file/clients';
import { FolderSelect } from '@/features/file/components';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { GrpcStorageObjectType } from '@packages/grpc';
import React from 'react';
import { Create } from '@refinedev/mui';
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
      const hasFolderWithSameName = await storageActionClient.isExistsFolder({
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
    <Create
      saveButtonProps={{ onClick: handleSubmit(handleSave), disabled: formLoading }}
      isLoading={formLoading}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <FolderSelect
          label="Folder"
          formField="parent"
          errors={errors}
          control={control}
          required
        />
        <ControlledTextField
          control={control}
          formField="name"
          fieldError={errors?.name}
          label="Name"
          required
        />
        <ControlledBooleanField control={control} formField="isPublic" label="Public" />
        <ControlledSingleSelect
          control={control}
          formField="type"
          defaultValue={GrpcStorageObjectType.FOLDER}
          label="Type"
          options={[GrpcStorageObjectType.FOLDER] /*Object.values(GrpcStorageObjectType) */}
          required
        />
      </Box>
    </Create>
  );
}
