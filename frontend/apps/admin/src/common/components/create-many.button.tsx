'use client';

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
      href={`/${database}/${resource}/create-many`}
    >
      Create many
    </Button>
  );
};
