'use client';

import { ONE_MB_BYTES } from '@/common/constants';
import { FileUploader } from '@/features/file/components';
import { useFileUpload } from '@/features/file/hooks';
import { Box, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcImage, GrpcStorageObject, GrpcStorageObjectType, GrpcUser } from '@packages/grpc';
import { useList, useGetIdentity } from '@refinedev/core';
import React from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { Controller } from 'react-hook-form';

type CreateForm = {
  file?: File;
  isPublic?: boolean;
  name?: string;
  parent?: string;
  alt?: string;
};

export default function ImageCreate() {
  const { isUploading, progress, handleUpload } = useFileUpload({
    resource: StorageDatabaseEntity.IMAGE,
  });

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
    watch,
    formState: { errors, isValid },
    control,
    setValue,
    refineCore: { onFinish, formLoading },
    handleSubmit,
  } = useForm<CreateForm>();

  const handleFileChange = (file?: File) => {
    setValue('name', file?.name ?? '');
  };

  const handleSave = async (data: CreateForm) => {
    const file = data.file;

    if (!file) {
      return;
    }

    const formData = new FormData();

    formData.append('image.alt', data.alt || '');

    if (data.parent) {
      formData.append('storage.name', data.name || '');
      formData.append('storage.isPublic', data.isPublic ? 'true' : 'false');
      formData.append('storage.parent', data.parent);
    }

    const createdFile = await handleUpload<GrpcImage>(file, formData);

    if (!createdFile) {
      return;
    }

    await onFinish(createdFile);
  };

  return (
    <Create
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: formLoading || !isValid || isUploading,
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
                value={field?.value || ''}
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
          name="alt"
          defaultValue={''}
          render={({ field }) => (
            <TextField
              {...field}
              error={!!errors?.alt}
              helperText={errors?.alt?.message?.toString()}
              margin="normal"
              fullWidth
              type="text"
              label={'Alt'}
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
        <FileUploader
          formField="file"
          errors={errors}
          control={control}
          watch={watch}
          progress={progress}
          isUploading={isUploading}
          onChange={handleFileChange}
          required
          maxSize={5 * ONE_MB_BYTES}
          accept={{ 'image/*': [] }}
          allowedTypes={['image']}
        />
      </Box>
    </Create>
  );
}
