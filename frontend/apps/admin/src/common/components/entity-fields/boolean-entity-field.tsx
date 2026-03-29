import { Typography } from '@mui/material';
import { BooleanField } from '@refinedev/mui';
import React, { FC } from 'react';

type BooleanFieldProps = {
  label: string;
  value?: boolean;
};

export const BooleanEntityField: FC<BooleanFieldProps> = ({ label, value }: BooleanFieldProps) => {
  return (
    <>
      <Typography variant="body1" fontWeight="bold" color="info">
        {label}
      </Typography>
      <BooleanField value={value} disableHoverListener />
    </>
  );
};
