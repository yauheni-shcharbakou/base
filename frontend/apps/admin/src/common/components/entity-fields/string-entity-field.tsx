import { Typography } from '@mui/material';
import { TextFieldComponent } from '@refinedev/mui';
import React, { FC } from 'react';

type StringFieldProps = {
  label: string;
  value?: string;
};

export const StringEntityField: FC<StringFieldProps> = ({ label, value }: StringFieldProps) => {
  return (
    <>
      <Typography variant="body1" fontWeight="bold" color="info">
        {label}
      </Typography>
      <TextFieldComponent value={value} />
    </>
  );
};
