'use client';

import { Box, MenuItem, TextField } from '@mui/material';
import { User, UserRole } from '@packages/grpc';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';

export default function UserEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors, isValid },
    refineCore: { formLoading, query },
  } = useForm<User>({});

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
          defaultValue={null}
        />
        <TextField
          {...register('role')}
          select
          fullWidth
          label="Role"
          margin="normal"
          name="role"
          defaultValue={entity?.role}
          error={!!errors?.role}
          helperText={errors?.role?.message?.toString()}
        >
          {Object.values(UserRole).map((role) => (
            <MenuItem key={role} value={role}>
              {role}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </Edit>
  );
}
