'use client';

import {
  combineControllerRules,
  EditFieldControllerProps,
} from '@/common/components/edit-fields/helpers';
import { Checkbox, FormControlLabel } from '@mui/material';
import { FormControlLabelProps } from '@mui/material/FormControlLabel/FormControlLabel';
import React from 'react';
import { Control, Controller, FieldValues, UseFormReturn } from 'react-hook-form';

type ControlledBooleanFieldProps<V extends FieldValues = FieldValues, E = any, T = V> = Pick<
  UseFormReturn<V, E, T>,
  'control'
> & {
  formField: string;
  fieldProps?: Omit<FormControlLabelProps, 'control' | 'value' | 'label' | 'required'>;
  label?: string;
  defaultValue?: boolean;
  controllerProps?: EditFieldControllerProps;
  required?: boolean;
};

export const ControlledBooleanField = <V extends FieldValues, E = any, T = V>({
  control,
  formField,
  fieldProps,
  label,
  defaultValue,
  controllerProps,
  required,
}: ControlledBooleanFieldProps<V, E, T>) => {
  return (
    <Controller
      control={control as Control}
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
