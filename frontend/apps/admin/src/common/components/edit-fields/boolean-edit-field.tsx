'use client';

import { EditFieldControllerProps, TypedController } from '@/common/components';
import { Checkbox, FormControlLabel } from '@mui/material';
import { FormControlLabelProps } from '@mui/material/FormControlLabel/FormControlLabel';
import React from 'react';
import { Control, FieldValues } from 'react-hook-form';

type ControlledBooleanFieldProps<V extends FieldValues = FieldValues, E = any, T = V> = {
  control?: Control<V, E, T>;
  fieldName: keyof V & string;
  fieldProps?: Omit<FormControlLabelProps, 'control' | 'value' | 'label' | 'required'>;
  label?: string;
  defaultValue?: boolean;
  controllerProps?: EditFieldControllerProps;
  required?: boolean;
};

export const ControlledBooleanField = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldName,
  fieldProps,
  label,
  defaultValue,
  controllerProps,
  required,
}: ControlledBooleanFieldProps<V, E, T>) => {
  return (
    <TypedController
      control={control}
      fieldName={fieldName}
      defaultValue={defaultValue || false}
      required={required}
      render={({ field }) => (
        <FormControlLabel
          {...field}
          value={field.value ?? false}
          control={<Checkbox checked={field?.value ?? false} required={required} />}
          label={label}
          required={required}
          {...(fieldProps ?? {})}
        />
      )}
      {...(controllerProps ?? {})}
    />
  );
};
