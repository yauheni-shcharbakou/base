import { Typography } from '@mui/material';
import { DateField } from '@refinedev/mui';
import React, { FC } from 'react';

type DateFieldProps = {
  label: string;
  value?: Date;
};

export const DateEntityField: FC<DateFieldProps> = ({ label, value }: DateFieldProps) => {
  return (
    <>
      <Typography variant="body1" fontWeight="bold" color="info">
        {label}
      </Typography>
      <DateField value={value} format="YYYY-MM-DDThh:mm:ssZ" />
    </>
  );
};
