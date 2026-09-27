'use client';

import { AppEdit, ControlledBooleanField, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { FolderSelect } from '@/features/storage/components';
import { folderActionProvider } from '@/features/storage/providers';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useEffect } from 'react';
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
  } = useValidatedForm<typeof schema, BrowserStorage.StorageObject>(schema);

  useEffect(() => {
    if (formLoading) {
      setValue('parent', '');
    }
  }, [formLoading, setValue]);

  const entity = query?.data?.data;

  const handleSave = async (data: Params) => {
    const updateData: Params = {
      isPublic: data.isPublic,
    };

    const isNameChanged = !!data.name && data.name !== entity?.name;
    const isParentChanged = !!data.parent && data.parent !== entity?.parentId;
    const parent = data.parent || entity?.parentId;
    const name = data.name || entity?.name;

    if (isNameChanged) {
      updateData.name = data.name;
    }

    if (isParentChanged) {
      updateData.parent = data.parent;
    }

    // A move needs the check as much as a rename: the name has to be free in the target folder, and
    // the backend refuses a taken name for a file as well as a folder. Its refusal reaches the page
    // only as a notification, so the name is checked first, to show the error on the field. A name
    // taken between this check and the save still ends in that notification.
    if (entity && (isNameChanged || isParentChanged) && parent && name) {
      const isNameTaken = await folderActionProvider.isNameTaken({
        parent,
        name,
        userId: entity.userId,
        ids: [],
        isFolder: entity.isFolder,
      });

      if (isNameTaken) {
        const kind = entity.isFolder ? 'folder' : 'file';
        setError('name', { type: 'manual', message: `Choose another name for ${kind}` });
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
            excludeChildrenOf={entity?.id}
            userId={entity?.userId}
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
