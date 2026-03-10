'use client';

import { ControlledBooleanField, TextEditField } from '@/common/components';
import { FolderSelect } from '@/features/file/components';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box } from '@mui/material';
import { GrpcStorageObject, GrpcStorageObjectType } from '@packages/grpc';
import { HttpError } from '@refinedev/core';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';
import zod, { z } from 'zod';

const schema = zod.object({
  parent: zod.string().optional(),
  name: zod.string().optional(),
  isPublic: zod.boolean(),
});

type Params = z.infer<typeof schema>;

export default function StorageObjectEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading, query },
    control,
    register,
  } = useForm<GrpcStorageObject, HttpError, Params>({
    resolver: zodResolver(schema),
  });

  const entity = query?.data?.data;

  return (
    <Edit
      isLoading={formLoading && !!entity}
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        {entity?.type !== GrpcStorageObjectType.FOLDER && (
          <FolderSelect
            label="Folder"
            formField="parent"
            errors={errors}
            control={control}
            userId={entity?.userId}
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
