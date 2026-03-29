import { TextFieldProps, Typography } from '@mui/material';
import { TextFieldComponent } from '@refinedev/mui';
import React, { FC } from 'react';

type StringFieldProps = Omit<TextFieldProps, 'label' | 'value' | 'variant' | 'defaultValue'> & {
  label: string;
  value?: string;
};

export const StringEntityField: FC<StringFieldProps> = ({
  label,
  value,
  ...fieldProps
}: StringFieldProps) => {
  return (
    <>
      <Typography variant="body1" fontWeight="bold" color="info">
        {label}
      </Typography>
      <TextFieldComponent {...fieldProps} value={value} />
    </>
  );
};
