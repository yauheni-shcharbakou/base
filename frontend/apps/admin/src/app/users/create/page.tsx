'use client';

import { User, UserRole } from '@packages/grpc';
import { Box, TextField, MenuItem } from '@mui/material';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';

export default function UserCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    formState: { errors },
  } = useForm<User>({});

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextField
          {...register('email', { required: 'This field is required' })}
          error={!!errors?.email}
          helperText={errors?.email?.message?.toString()}
          margin="normal"
          fullWidth
          type="email"
          label={'Email'}
          name="email"
        />
        <TextField
          {...register('password', { required: 'This field is required', minLength: 8 })}
          error={!!errors?.password}
          helperText={errors?.password?.message?.toString()}
          margin="normal"
          fullWidth
          type="password"
          label={'Password'}
          name="password"
        />
        <TextField
          select
          fullWidth
          label="Role"
          margin="normal"
          {...register('role')}
          defaultValue={UserRole.USER}
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
    </Create>
  );
}
