'use client';

import {
  combineControllerRules,
  EditFieldControllerProps,
} from '@/common/components/edit-fields/helpers';
import { MenuItem, TextField } from '@mui/material';
import React, { FC, useMemo } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';

type SelectOptions = {
  label: string;
  value: string;
};

type ControlledSingleSelectProps = Pick<UseFormReturn<any>, 'control'> & {
  formField: string;
  fieldError?: FieldErrors[string];
  label?: string;
  defaultValue?: string;
  controllerProps?: EditFieldControllerProps;
  options: string[] | SelectOptions[];
  required?: boolean;
};

export const ControlledSingleSelect: FC<ControlledSingleSelectProps> = ({
  control,
  formField,
  fieldError,
  defaultValue,
  label,
  controllerProps,
  options: optionsFromProps,
  required,
}: ControlledSingleSelectProps) => {
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
      control={control}
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
