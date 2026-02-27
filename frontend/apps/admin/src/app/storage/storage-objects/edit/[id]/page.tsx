'use client';

import { Box, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { StorageDatabaseEntity } from '@packages/common';
import {
  GrpcStorageObject,
  GrpcStorageObjectType,
  GrpcStorageObjectUpdateSet,
} from '@packages/grpc';
import { HttpError, useList } from '@refinedev/core';
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
    register,
  } = useForm<GrpcStorageObject, HttpError, GrpcStorageObjectUpdateSet>({});

  const entity = query?.data?.data;

  const {
    // query,
    result: { data: folders },
  } = useList<GrpcStorageObject>({
    resource: StorageDatabaseEntity.STORAGE_OBJECT,
    filters: [
      {
        field: 'user',
        value: entity?.user,
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
      enabled: !!entity?.user,
    },
  });

  return (
    <Edit
      isLoading={formLoading && !!entity}
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading || !folders?.length,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        {entity?.type !== GrpcStorageObjectType.FOLDER && (
          <Controller
            control={control}
            name="parent"
            defaultValue={entity?.parent || ''}
            render={({ field }) => {
              return (
                <TextField
                  {...field}
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
        )}
        <TextField
          {...register('name', { setValueAs: (value) => value || undefined })}
          error={!!errors?.name}
          helperText={errors?.name?.message?.toString()}
          margin="normal"
          fullWidth
          type="text"
          label={'Name'}
          name="name"
          defaultValue={''}
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
