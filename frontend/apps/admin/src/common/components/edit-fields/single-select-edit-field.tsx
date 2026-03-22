'use client';

import {
  combineControllerRules,
  EditFieldControllerProps,
} from '@/common/components/edit-fields/helpers';
import { MenuItem, TextField } from '@mui/material';
import React, { useMemo } from 'react';
import { Control, Controller, FieldErrors, FieldValues, UseFormReturn } from 'react-hook-form';

type SelectOptions = {
  label: string;
  value: string;
};

type ControlledSingleSelectProps<V extends FieldValues = FieldValues, E = any, T = V> = Pick<
  UseFormReturn<V, E, T>,
  'control'
> & {
  formField: string;
  fieldError?: FieldErrors[string];
  label?: string;
  defaultValue?: string;
  controllerProps?: EditFieldControllerProps;
  options: string[] | SelectOptions[];
  required?: boolean;
};

export const ControlledSingleSelect = <V extends FieldValues, E = any, T = V>({
  control,
  formField,
  fieldError,
  defaultValue,
  label,
  controllerProps,
  options: optionsFromProps,
  required,
}: ControlledSingleSelectProps<V, E, T>) => {
  const options = useMemo(() => {
    const opts: SelectOptions[] = [];

    if (!required) {
      opts.push({ label: 'None', value: '' });
    }

    optionsFromProps.forEach((option) => {
      opts.push(typeof option === 'string' ? { label: option, value: option } : option);
    });

    return opts;
  }, [optionsFromProps, required]);

  return (
    <Controller
      name={formField}
      control={control as Control}
      defaultValue={defaultValue || ''}
      render={({ field }) => {
        return (
          <TextField
            {...field}
            value={field?.value || ''}
            error={!!fieldError}
            helperText={fieldError?.message?.toString()}
            select
            label={label}
            fullWidth
            margin="normal"
            required={required}
            slotProps={{
              select: {
                displayEmpty: !required,
              },
              inputLabel: {
                shrink: required ? undefined : true,
              },
            }}
          >
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        );
      }}
      {...combineControllerRules(controllerProps, required)}
    />
  );
};
