'use client';

import { Typography } from '@mui/material';
import { BooleanField, DateField, TextFieldComponent } from '@refinedev/mui';
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
      <BooleanField value={value} />
    </>
  );
};

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
