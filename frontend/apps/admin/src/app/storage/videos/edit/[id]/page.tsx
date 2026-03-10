'use client';

import { TextEditField } from '@/common/components';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box } from '@mui/material';
import { HttpError } from '@refinedev/core';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';
import zod, { z } from 'zod';

const schema = zod.object({
  title: zod.string().optional(),
  description: zod.string().optional(),
});

type Params = z.infer<typeof schema>;

export default function VideoEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading, query },
    register,
  } = useForm<Params, HttpError, Params>({
    resolver: zodResolver(schema),
  });

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
        <TextEditField
          register={register('title', { setValueAs: (value) => value || undefined })}
          label="Title"
          value={entity?.title}
          fieldError={errors?.title}
        />
        <TextEditField
          register={register('description', { setValueAs: (value) => value || undefined })}
          label="Description"
          value={entity?.description}
          fieldError={errors?.description}
        />
      </Box>
    </Edit>
  );
}
