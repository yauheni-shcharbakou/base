'use client';

import { Box, TextField, MenuItem } from '@mui/material';
import { GrpcUser, GrpcUserRole } from '@packages/grpc';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { Controller } from 'react-hook-form';

export default function UserCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    formState: { errors, isValid },
    control,
  } = useForm<GrpcUser>({});

  return (
    <Create
      isLoading={formLoading}
      saveButtonProps={{ ...saveButtonProps, disabled: !isValid || formLoading }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextField
          {...register('email', { required: true })}
          error={!!errors?.email}
          helperText={errors?.email?.message?.toString()}
          margin="normal"
          fullWidth
          type="email"
          label={'Email'}
          name="email"
          required
        />
        <TextField
          {...register('password', { required: true, minLength: 8 })}
          error={!!errors?.password}
          helperText={errors?.password?.message?.toString()}
          margin="normal"
          fullWidth
          type="password"
          label={'Password'}
          name="password"
          required
        />
        <Controller
          name={'role'}
          control={control}
          render={({ field }) => {
            return (
              <TextField
                {...field}
                value={field?.value || GrpcUserRole.USER}
                select
                label="Role"
                fullWidth
                margin="normal"
              >
                {Object.values(GrpcUserRole).map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </TextField>
            );
          }}
        />
      </Box>
    </Create>
  );
}
