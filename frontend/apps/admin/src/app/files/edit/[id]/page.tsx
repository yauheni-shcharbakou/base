'use client';

import { Box, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { GrpcFile } from '@packages/grpc';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';
import { Controller } from 'react-hook-form';

export default function FileEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading, query },
    control,
  } = useForm<GrpcFile>({});

  const entity = query?.data?.data;

  return (
    <Edit isLoading={formLoading && !!entity} saveButtonProps={saveButtonProps}>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <Controller
          control={control}
          name="name"
          defaultValue={entity?.name || ''}
          render={({ field }) => (
            <TextField
              {...field}
              error={!!errors?.name}
              helperText={errors?.name?.message?.toString()}
              margin="normal"
              fullWidth
              type="text"
              label={'Name'}
            />
          )}
        />
        <Controller
          control={control}
          name="isPublic"
          defaultValue={entity?.isPublic ?? false}
          render={({ field }) => (
            <FormControlLabel
              {...field}
              control={<Checkbox checked={field?.value ?? false} />}
              label="Public"
            />
          )}
        />
      </Box>
    </Edit>
  );
}
