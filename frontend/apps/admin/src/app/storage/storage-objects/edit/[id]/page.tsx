'use client';

import { ControlledBooleanField, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { folderActionClient } from '@/features/storage/clients';
import { FolderSelect } from '@/features/storage/components';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { GrpcStorageObject, GrpcStorageObjectType } from '@packages/grpc';
import { Edit } from '@refinedev/mui';
import React from 'react';
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
  } = useValidatedForm<typeof schema, GrpcStorageObject>(schema);

  const entity = query?.data?.data;

  const handleSave = async (data: Params) => {
    if (entity?.type === GrpcStorageObjectType.FOLDER && entity?.parentId && data.name) {
      const hasFolderWithSameName = await folderActionClient.isExistsFolder({
        parent: entity?.parentId,
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
    <Edit
      isLoading={formLoading && !!entity}
      saveButtonProps={{ onClick: handleSubmit(handleSave), disabled: formLoading }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        {entity?.type !== GrpcStorageObjectType.FOLDER && (
          <FolderSelect label="Folder" formField="parent" errors={errors} control={control} />
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
