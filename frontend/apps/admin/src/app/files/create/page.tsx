'use client';

import { FileUploader } from '@/components/file-uploader';
import { ONE_MB_BYTES } from '@/constants';
import { useUpload } from '@/hooks/use-upload';
import { Box, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { FileDatabaseCollection } from '@packages/common';
import { GrpcFile } from '@packages/grpc';
import React from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { Controller } from 'react-hook-form';

type CreateForm = {
  file?: File;
  isPublic?: boolean;
  name?: string;
};

export default function FileCreate() {
  const { isUploading, progress, handleUpload } = useUpload({
    resource: FileDatabaseCollection.FILE,
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
    if (!data.file) {
      return;
    }

    const createdFile = await handleUpload<GrpcFile>(data.file, {
      name: data.name || '',
      isPublic: data.isPublic,
    });

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
          maxSize={100 * ONE_MB_BYTES}
          types={['image/*', 'text/*', 'application/*', 'audio/*']}
        />
      </Box>
    </Create>
  );
}
