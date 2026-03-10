'use client';

import { ControlledSingleSelect, TextEditField } from '@/common/components';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box } from '@mui/material';
import { GrpcUser, GrpcUserRole } from '@packages/grpc';
import { HttpError } from '@refinedev/core';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';
import zod, { z } from 'zod';

const schema = zod.object({
  email: zod.email().optional(),
  password: zod.string().min(8).optional(),
  role: zod.enum(Object.values(GrpcUserRole)).optional(),
});

type Params = z.infer<typeof schema>;

export default function UserEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors },
    refineCore: { formLoading, query },
    control,
    watch,
  } = useForm<GrpcUser, HttpError, Params>({
    resolver: zodResolver(schema),
  });

  const entity = query?.data?.data;

  return (
    <Edit isLoading={formLoading && !!entity} saveButtonProps={saveButtonProps}>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextEditField
          register={register('email', { setValueAs: (value) => value || undefined })}
          label="Email"
          value={entity?.email}
          fieldError={errors?.email}
          type="email"
        />
        <TextEditField
          register={register('password', { setValueAs: (value) => value || undefined })}
          label="Password"
          value={watch('password')}
          fieldError={errors?.password}
          type="password"
        />
        <ControlledSingleSelect
          control={control}
          formField="role"
          defaultValue={entity?.role}
          label="Role"
          options={Object.values(GrpcUserRole)}
          required
        />
      </Box>
    </Edit>
  );
}
