'use client';

import { AppCreate, ControlledSingleSelect, ControlledTextField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { Box } from '@mui/material';
import { GrpcUserRole } from '@packages/grpc';
import React from 'react';
import zod from 'zod';

export default function UserCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    formState: { errors },
    control,
  } = useValidatedForm({
    email: zod.email(),
    password: zod.string().min(8),
    role: zod.enum(Object.values(GrpcUserRole)),
  });

  return (
    <AppCreate
      isLoading={formLoading}
      saveButtonProps={{ ...saveButtonProps, disabled: formLoading }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <ControlledTextField
          control={control}
          fieldName="email"
          fieldErr={errors?.email}
          label="Email"
          type="email"
          required
        />
        <ControlledTextField
          control={control}
          fieldName="password"
          fieldErr={errors?.password}
          label="Password"
          type="password"
          required
        />
        <ControlledSingleSelect
          control={control}
          fieldName="role"
          defaultValue={GrpcUserRole.USER}
          label="Role"
          options={Object.values(GrpcUserRole)}
          required
        />
      </Box>
    </AppCreate>
  );
}
