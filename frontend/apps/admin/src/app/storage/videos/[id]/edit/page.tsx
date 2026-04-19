'use client';

import { AppEdit, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { Box } from '@mui/material';
import React from 'react';
import zod from 'zod';

export default function VideoEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading, query },
    register,
  } = useValidatedForm({
    title: zod.string().optional(),
    description: zod.string().optional(),
  });

  const entity = query?.data?.data;

  return (
    <AppEdit
      isLoading={formLoading && !!entity}
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextEditField
          register={register('title', { setValueAs: (value) => value || undefined })}
          label="Title"
          value={entity?.title}
          fieldErr={errors?.title}
        />
        <TextEditField
          register={register('description', { setValueAs: (value) => value || undefined })}
          label="Description"
          value={entity?.description}
          fieldErr={errors?.description}
        />
      </Box>
    </AppEdit>
  );
}
