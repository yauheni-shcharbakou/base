'use client';

import {
  AppCreate,
  ControlledBooleanField,
  ControlledSingleSelect,
  ControlledTextField,
} from '@/common/components';
import { FieldErr } from '@/common/types';
import { UserSelect } from '@/features/auth/components';
import { SelectOption } from '@/common/components';
import { FolderPickerField, MediaSelect } from '@/features/storage/components';
import { isLeafType, MEDIA_BY_TYPE } from '@/features/storage/helpers';
import { useResetParentOnOwnerChange, useStorageObjectForm } from '@/features/storage/hooks';
import { Box } from '@mui/material';
import { SchemaTypeOf } from '@packages/common';
import { BrowserAuth, BrowserStorage } from '@packages/proto';
import { useGetIdentity } from '@refinedev/core';
import { useEffect, useState } from 'react';
import zod from 'zod';

const schema = {
  userId: zod.string(),
  parent: zod.string().nonempty(),
  name: zod.string().nonempty(),
  isPublic: zod.boolean(),
  type: zod.enum(Object.values(BrowserStorage.StorageObjectType)),
  // The id of the file, image or video a leaf places; sent in the field its type names.
  media: zod.string().optional(),
};

type Params = SchemaTypeOf<typeof schema>;

export default function StorageObjectCreate() {
  const { data: user } = useGetIdentity<BrowserAuth.User>();

  const {
    formState: { errors },
    control,
    refineCore: { formLoading, onFinish },
    handleSubmit,
    watch,
    getValues,
    setValue,
    setError,
  } = useStorageObjectForm(schema);

  const userId = watch('userId');
  const type = watch('type');
  const media = watch('media');

  const [mediaOptions, setMediaOptions] = useState<SelectOption[]>([]);

  useResetParentOnOwnerChange(userId, (id) => setValue('parent', id));

  // Another owner or another type lists other media: a pick from the old list no longer applies.
  useEffect(() => {
    setValue('media', '');
  }, [userId, type, setValue]);

  // A leaf is usually named after what it places; a name typed already is kept.
  useEffect(() => {
    const picked = mediaOptions.find((option) => option.value === media);

    if (picked && !getValues('name')) {
      setValue('name', picked.label, { shouldValidate: true });
    }
  }, [media, mediaOptions, getValues, setValue]);

  // No name check here: the backend refuses a taken name, and `useStorageObjectForm` shows that
  // refusal on the field. Choosing the media is only what the form needs filled in; whether the
  // backend accepts it is its call.
  const handleSave = ({ media: mediaId, ...data }: Params) => {
    if (!isLeafType(data.type)) {
      return onFinish(data);
    }

    if (!mediaId) {
      setError('media', {
        type: 'required',
        message: `Choose a ${MEDIA_BY_TYPE[data.type].field}`,
      });
      return;
    }

    return onFinish({ ...data, [MEDIA_BY_TYPE[data.type].field]: mediaId });
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
              required
            />
            <FolderPickerField
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
          fieldErr={errors?.type as FieldErr}
          defaultValue={BrowserStorage.StorageObjectType.FOLDER}
          label="Type"
          options={Object.values(BrowserStorage.StorageObjectType)}
          required
        />
        {isLeafType(type) && (
          <MediaSelect
            key={type}
            label={MEDIA_BY_TYPE[type].label}
            fieldName="media"
            fieldErr={errors?.media as FieldErr}
            control={control}
            type={type}
            userId={userId}
            onOptionsLoaded={setMediaOptions}
            required
          />
        )}
      </Box>
    </AppCreate>
  );
}
