'use client';

import {
  combineControllerRules,
  EditFieldControllerProps,
} from '@/common/components/edit-fields/helpers';
import { Checkbox, FormControlLabel } from '@mui/material';
import { FormControlLabelProps } from '@mui/material/FormControlLabel/FormControlLabel';
import React, { FC } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';

type ControlledBooleanFieldProps = Pick<UseFormReturn<any>, 'control'> & {
  formField: string;
  fieldProps?: Omit<FormControlLabelProps, 'control' | 'value' | 'label' | 'required'>;
  label?: string;
  defaultValue?: boolean;
  controllerProps?: EditFieldControllerProps;
  required?: boolean;
};

export const ControlledBooleanField: FC<ControlledBooleanFieldProps> = ({
  control,
  formField,
  fieldProps,
  label,
  defaultValue,
  controllerProps,
  required,
}: ControlledBooleanFieldProps) => {
  return (
    <Controller
      control={control}
      name={formField}
      defaultValue={defaultValue || false}
      render={({ field }) => (
        <FormControlLabel
          {...field}
          value={field.value ?? false}
          control={<Checkbox checked={field?.value ?? false} required={required} />}
          label={label}
          required={required}
          {...fieldProps}
        />
      )}
      {...combineControllerRules(controllerProps, required)}
    />
  );
};
