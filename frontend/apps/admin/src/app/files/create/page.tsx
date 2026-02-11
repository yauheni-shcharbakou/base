'use client';

import { Uploader } from '@/components/uploader';
import { useUpload } from '@/hooks/use-upload';
import { Box, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { FileDatabaseCollection } from '@packages/common';
import React, { useEffect, useState } from 'react';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { Controller } from 'react-hook-form';

type CreateForm = {
  file?: File;
  isPublic?: boolean;
  name?: string;
};

export default function FileCreate() {
  const [isMounted, setIsMounted] = useState(false);

  const { isUploading, progress, handleUpload } = useUpload({
    resource: FileDatabaseCollection.FILE,
  });

  const {
    watch,
    formState: { errors },
    control,
    setValue,
    refineCore: { onFinish },
    handleSubmit,
  } = useForm<CreateForm>({
    refineCoreProps: {
      queryOptions: {
        enabled: isMounted,
      },
    },
  });

  useEffect(() => {
    setIsMounted(() => true);
  }, []);

  const handleFileChange = (file?: File) => {
    setValue('name', file?.name ?? '');
  };

  const handleSave = async (data: CreateForm) => {
    const formData = new FormData();

    formData.append('name', data.name ?? '');
    formData.append('isPublic', data.isPublic ? 'true' : 'false');

    if (data.file) {
      formData.append('file', data.file);
    }

    await handleUpload(formData, data.file, onFinish);
  };

  return (
    <Create
      saveButtonProps={{
        onClick: handleSubmit(handleSave),
        disabled: isUploading,
      }}
      isLoading={!isMounted}
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
        <Uploader
          formField="file"
          errors={errors}
          control={control}
          watch={watch}
          progress={progress}
          isUploading={isUploading}
          onChange={handleFileChange}
        />
      </Box>
    </Create>
  );
}
