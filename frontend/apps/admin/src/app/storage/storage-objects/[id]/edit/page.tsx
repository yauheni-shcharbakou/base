'use client';

import { AppEdit, ControlledBooleanField, TextEditField } from '@/common/components';
import { useReplacingNotification } from '@/common/hooks';
import { FolderPickerField } from '@/features/storage/components';
import { getVisibilityLock } from '@/features/storage/helpers';
import { useStorageObjectForm, useUserFolders } from '@/features/storage/hooks';
import { Box, FormHelperText } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import zod from 'zod';

const schema = {
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean().optional(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function StorageObjectEdit() {
  const {
    formState: { errors },
    refineCore: { formLoading, query, onFinish },
    control,
    register,
    handleSubmit,
    setValue,
  } = useStorageObjectForm<typeof schema, BrowserStorage.StorageObject>(schema);
  const notify = useReplacingNotification();
  const entity = query?.data?.data;
  // The folder picker reads the same list: one call for both.
  const folders = useUserFolders(entity?.parentId ? entity.userId : undefined);
  const parentId = useWatch({ control, name: 'parent' }) || entity?.parentId;
  const parentFolder = folders.data?.find(({ id }) => id === parentId);
  // In a public folder, or on a move, the folder decides; the checkbox shows what will be saved.
  const visibilityLock = getVisibilityLock(parentFolder, !!entity && parentId !== entity.parentId);
  const lockedIsPublic = visibilityLock?.isPublic;

  // Not a field of the entity, which has `parentId`: the form's reset from the record leaves it out.
  useEffect(() => {
    if (entity) {
      setValue('parent', entity.parentId ?? '');
    }
  }, [entity, setValue]);

  // Back to the record's own value once nothing holds it, as when a move is undone.
  useEffect(() => {
    if (entity) {
      setValue('isPublic', lockedIsPublic ?? entity.isPublic);
    }
  }, [entity, lockedIsPublic, setValue]);

  const handleSave = async (data: Params) => {
    // A held visibility is not the caller's to send: the service decides it the same way.
    const updateData: Params = visibilityLock ? {} : { isPublic: data.isPublic };

    const isNameChanged = !!data.name && data.name !== entity?.name;
    const isParentChanged = !!data.parent && data.parent !== entity?.parentId;

    if (isNameChanged) {
      updateData.name = data.name;
    }

    if (isParentChanged) {
      updateData.parent = data.parent;
    }

    // No name check here: the backend refuses a name taken by a rename in place, and
    // `useStorageObjectForm` shows that refusal on the field. A move is never refused for its name:
    // it lands under a suffixed one, which is worth saying.
    const result = await onFinish(updateData);
    const requestedName = updateData.name ?? entity?.name;
    const savedName = (result?.data as BrowserStorage.StorageObject | undefined)?.name;

    if (isParentChanged && savedName && savedName !== requestedName) {
      notify({
        type: 'success',
        message: `Moved as “${savedName}”`,
        description: `“${requestedName}” was taken in that folder.`,
        key: `storage-object-renamed-${entity?.id}`,
      });
    }
  };

  return (
    <AppEdit
      isLoading={formLoading && !!entity}
      saveButtonProps={{ onClick: handleSubmit(handleSave), disabled: formLoading }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        {/* A root folder has no folder to be in. */}
        {entity?.parentId && (
          <FolderPickerField
            fieldName="parent"
            fieldErr={errors?.parent}
            control={control}
            userId={entity.userId}
            blockedIds={[entity.id]}
            required
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
          fieldProps={{ disabled: !!visibilityLock }}
        />
        {visibilityLock && (
          <FormHelperText sx={{ mt: -0.5 }}>{visibilityLock.reason}</FormHelperText>
        )}
      </Box>
    </AppEdit>
  );
}
