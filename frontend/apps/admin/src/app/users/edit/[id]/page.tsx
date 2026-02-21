'use client';

import { Box, MenuItem, TextField } from '@mui/material';
import { GrpcUser, GrpcUserRole } from '@packages/grpc';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { Controller } from 'react-hook-form';

export default function UserEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors },
    refineCore: { formLoading, query },
    control,
  } = useForm<GrpcUser>({});

  const entity = query?.data?.data;

  return (
    <Edit isLoading={formLoading && !!entity} saveButtonProps={saveButtonProps}>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextField
          {...register('email')}
          error={!!errors?.email}
          helperText={errors?.email?.message?.toString()}
          margin="normal"
          fullWidth
          type="email"
          label={'Email'}
          name="email"
        />
        <TextField
          {...register('password', { minLength: 8, setValueAs: (value) => value || undefined })}
          error={!!errors?.password}
          helperText={errors?.password?.message?.toString()}
          margin="normal"
          fullWidth
          type="password"
          label={'Password'}
          name="password"
          defaultValue={''}
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
    </Edit>
  );
}
