'use client';

import { ControlledSingleSelect, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { Box } from '@mui/material';
import { GrpcUserRole } from '@packages/grpc';
import { Edit } from '@refinedev/mui';
import React from 'react';
import zod from 'zod';

export default function UserEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors },
    refineCore: { formLoading, query },
    control,
    watch,
  } = useValidatedForm({
    email: zod.email().optional(),
    password: zod.string().min(8).optional(),
    role: zod.enum(Object.values(GrpcUserRole)).optional(),
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
