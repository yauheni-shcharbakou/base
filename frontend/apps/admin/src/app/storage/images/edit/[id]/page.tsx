'use client';

import { Box, TextField } from '@mui/material';
import { GrpcImageUpdateSet } from '@packages/grpc';
import { HttpError } from '@refinedev/core';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';

export default function ImageEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading, query },
    register,
  } = useForm<GrpcImageUpdateSet, HttpError, GrpcImageUpdateSet>({});

  const entity = query?.data?.data;

  return (
    <Edit
      isLoading={formLoading && !!entity}
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextField
          {...register('alt', { setValueAs: (value) => value || undefined })}
          error={!!errors?.alt}
          helperText={errors?.alt?.message?.toString()}
          margin="normal"
          fullWidth
          type="text"
          label={'Alt'}
          name="alt"
          defaultValue={''}
        />
      </Box>
    </Edit>
  );
}
