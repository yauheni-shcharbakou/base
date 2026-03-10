'use client';

import { TextEditField } from '@/common/components';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box } from '@mui/material';
import { HttpError } from '@refinedev/core';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import React from 'react';
import zod, { z } from 'zod';

const schema = zod.object({ alt: zod.string().optional() });

type Params = z.infer<typeof schema>;

export default function ImageEdit() {
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
        disabled: formLoading || !entity,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextEditField
          register={register('alt', { setValueAs: (value) => value || undefined })}
          label="Alt"
          value={entity?.alt}
          fieldError={errors?.alt}
        />
      </Box>
    </Edit>
  );
}
