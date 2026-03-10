'use client';

import {
  ControlledBooleanField,
  ControlledSingleSelect,
  ControlledTextField,
} from '@/common/components';
import { FolderSelect } from '@/features/file/components';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box } from '@mui/material';
import { GrpcStorageObjectType, GrpcUser } from '@packages/grpc';
import { HttpError, useGetIdentity } from '@refinedev/core';
import React from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import zod, { z } from 'zod';

const schema = zod.object({
  parent: zod.string().nonempty(),
  name: zod.string().nonempty(),
  isPublic: zod.boolean(),
  type: zod.enum(Object.values(GrpcStorageObjectType)),
});

type Params = z.infer<typeof schema>;

export default function StorageObjectCreate() {
  const { data: user } = useGetIdentity<GrpcUser>();

  const {
    formState: { errors },
    control,
    refineCore: { formLoading },
    saveButtonProps,
  } = useForm<Params, HttpError, Params>({
    resolver: zodResolver(schema),
  });

  return (
    <Create saveButtonProps={{ ...saveButtonProps, disabled: formLoading }} isLoading={formLoading}>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }}>
        <FolderSelect
          label="Folder"
          formField="parent"
          errors={errors}
          control={control}
          required
          userId={user?.id}
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
          options={Object.values(GrpcStorageObjectType)}
          required
        />
      </Box>
    </Create>
  );
}
