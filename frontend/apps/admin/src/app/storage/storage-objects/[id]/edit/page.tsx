'use client';

import { AppEdit, ControlledBooleanField, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { folderActionProvider } from '@/features/storage/providers';
import { FolderSelect } from '@/features/storage/components';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import React, { useEffect } from 'react';
import zod from 'zod';
import type { BrowserStorage } from '@packages/proto';

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
  } = useValidatedForm<typeof schema, BrowserStorage.StorageObject>(schema);

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
      const hasFolderWithSameName = await folderActionProvider.isExistsFolder({
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
    <AppEdit
      isLoading={formLoading && !!entity}
      saveButtonProps={{ onClick: handleSubmit(handleSave), disabled: formLoading }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        {!formLoading && (
          <FolderSelect
            label="Folder"
            fieldName="parent"
            fieldErr={errors?.parent}
            control={control}
            onOptionsLoaded={() => setValue('parent', entity?.parentId)}
            id={entity?.id}
          />
        )}
        <TextEditField
          register={register('name', { setValueAs: (value) => value || undefined })}
          label="Name"
          value={entity?.name}
          fieldErr={errors?.name}
        />
        <ControlledBooleanField
          control={control}
          fieldName="isPublic"
          label="Public"
          defaultValue={entity?.isPublic}
        />
      </Box>
    </AppEdit>
  );
}
