'use client';

import { pathProvider } from '@/common/providers';
import { AddBoxOutlined } from '@mui/icons-material';
import Button from '@mui/material/Button';
import { Database } from '@packages/common';
import React, { FC } from 'react';

type Props = {
  database: Database;
  resource: string;
};

export const CreateManyButton: FC<Props> = ({ database, resource }: Props) => {
  return (
    <Button
      variant="outlined"
      startIcon={<AddBoxOutlined />}
      component="a"
      href={pathProvider.getCreateManyPath(database, resource)}
    >
      Create many
    </Button>
  );
};
