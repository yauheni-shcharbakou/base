'use client';

import {
  AppCreate,
  ControlledBooleanField,
  ControlledSingleSelect,
  ControlledTextField,
} from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { FieldErr } from '@/common/types';
import { UserSelect } from '@/features/auth/components';
import { FolderSelect } from '@/features/storage/components';
import { folderActionProvider } from '@/features/storage/providers';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { BrowserAuth, BrowserStorage } from '@packages/proto';
import { useGetIdentity } from '@refinedev/core';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  parent: zod.string().nonempty(),
  name: zod.string().nonempty(),
  isPublic: zod.boolean(),
  type: zod.enum(Object.values(BrowserStorage.StorageObjectType)),
};

type Params = SchemaTypeOf<typeof schema>;

export default function StorageObjectCreate() {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

  const {
    formState: { errors },
    control,
    refineCore: { formLoading, onFinish },
    setError,
    clearErrors,
    handleSubmit,
    watch,
  } = useValidatedForm(schema);

  const userId = watch('userId');

  const handleSave = async (data: Params) => {
    if (data.type === BrowserStorage.StorageObjectType.FOLDER) {
      const hasFolderWithSameName = await folderActionProvider.isExistsFolder({
        parent: data.parent,
        name: data.name,
        userId,
        ids: [],
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
        {user?.id && (
          <>
            <UserSelect
              label="User"
              fieldName="userId"
              fieldErr={errors?.userId as FieldErr}
              control={control}
              defaultValue={user?.id}
            />
            <FolderSelect
              label="Folder"
              fieldName="parent"
              fieldErr={errors?.parent as FieldErr}
              control={control}
              userId={userId}
              required
            />
          </>
        )}

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
          defaultValue={BrowserStorage.StorageObjectType.FOLDER}
          label="Type"
          options={[BrowserStorage.StorageObjectType.FOLDER]}
          required
        />
      </Box>
    </AppCreate>
  );
}
