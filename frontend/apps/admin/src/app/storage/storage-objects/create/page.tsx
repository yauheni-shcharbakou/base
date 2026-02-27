'use client';

import { Box, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { StorageDatabaseEntity } from '@packages/common';
import {
  GrpcStorageObject,
  GrpcStorageObjectMetadata,
  GrpcStorageObjectType,
  GrpcUser,
} from '@packages/grpc';
import { useList, useGetIdentity } from '@refinedev/core';
import React from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { Controller } from 'react-hook-form';

export default function StorageObjectCreate() {
  const { data: user } = useGetIdentity<GrpcUser>();

  const {
    result: { data: folders },
  } = useList<GrpcStorageObject>({
    resource: StorageDatabaseEntity.STORAGE_OBJECT,
    filters: [
      {
        field: 'user',
        value: user?.id,
        operator: 'eq',
      },
      {
        field: 'type',
        value: GrpcStorageObjectType.FOLDER,
        operator: 'eq',
      },
    ],
    pagination: {
      pageSize: 100,
      currentPage: 1,
    },
    queryOptions: {
      enabled: !!user?.id,
    },
  });

  const {
    formState: { errors, isValid },
    control,
    refineCore: { formLoading },
    saveButtonProps,
  } = useForm<GrpcStorageObjectMetadata>();

  return (
    <Create
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading || !isValid || !folders?.length,
      }}
      isLoading={formLoading}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Controller
          control={control}
          name="parent"
          rules={{ required: true }}
          render={({ field }) => {
            return (
              <TextField
                {...field}
                value={field.value || ''}
                error={!!errors?.parent}
                helperText={errors?.parent?.message?.toString()}
                select
                label="Folder"
                fullWidth
                margin="normal"
              >
                {folders.map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.folderPath}
                  </MenuItem>
                ))}
              </TextField>
            );
          }}
        />
        <Controller
          control={control}
          name="name"
          defaultValue={''}
          rules={{ required: true }}
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
          defaultValue={false}
          render={({ field }) => (
            <FormControlLabel
              {...field}
              value={field.value ?? false}
              control={<Checkbox />}
              label="Public"
            />
          )}
        />
        <Controller
          name={'type'}
          control={control}
          defaultValue={GrpcStorageObjectType.FOLDER}
          render={({ field }) => {
            return (
              <TextField {...field} select label="Type" fullWidth margin="normal">
                {Object.values(GrpcStorageObjectType).map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
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
