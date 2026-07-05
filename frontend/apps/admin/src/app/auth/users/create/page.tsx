'use client';

import { AppCreate, ControlledSingleSelect, ControlledTextField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { Box } from '@mui/material';
import { BrowserAuth } from '@packages/proto';
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
    role: zod.enum(Object.values(BrowserAuth.UserRole)),
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
          defaultValue={BrowserAuth.UserRole.USER}
          label="Role"
          options={Object.values(BrowserAuth.UserRole)}
          required
        />
      </Box>
    </AppCreate>
  );
}
