'use client';

import { ControlledSingleSelect, ControlledTextField } from '@/common/components';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box } from '@mui/material';
import { GrpcUserRole } from '@packages/grpc';
import { HttpError } from '@refinedev/core';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';
import zod, { z } from 'zod';

const schema = zod.object({
  email: zod.email(),
  password: zod.string().min(8),
  role: zod.enum(Object.values(GrpcUserRole)),
});

type Params = z.infer<typeof schema>;

export default function UserCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    formState: { errors },
    control,
  } = useForm<Params, HttpError, Params>({
    resolver: zodResolver(schema),
  });

  return (
    <Create isLoading={formLoading} saveButtonProps={{ ...saveButtonProps, disabled: formLoading }}>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <ControlledTextField
          control={control}
          formField="email"
          fieldError={errors?.email}
          label="Email"
          type="email"
          required
        />
        <ControlledTextField
          control={control}
          formField="password"
          fieldError={errors?.password}
          label="Password"
          type="password"
          required
        />
        <ControlledSingleSelect
          control={control}
          formField="role"
          defaultValue={GrpcUserRole.USER}
          label="Role"
          options={Object.values(GrpcUserRole)}
          required
        />
      </Box>
    </Create>
  );
}
