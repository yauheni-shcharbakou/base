'use client';

import { FieldErr } from '@/common/types';
import { MenuItem, TextField } from '@mui/material';
import React, { useMemo } from 'react';
import { Control, FieldValues } from 'react-hook-form';
import {
  EditFieldControllerProps,
  TypedController,
} from '@/common/components/edit-fields/wrappers/typed-controller';

export type SelectOption = {
  label: string;
  value: string | number;
};

export type ControlledSingleSelectProps<V extends FieldValues = FieldValues, E = any, T = V> = {
  control?: Control<V, E, T>;
  fieldName: keyof V & string;
  fieldErr?: FieldErr;
  label?: string;
  defaultValue?: string | number | SelectOption;
  controllerProps?: EditFieldControllerProps;
  options: string[] | number[] | SelectOption[];
  required?: boolean;
};

export const ControlledSingleSelect = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldName,
  fieldErr,
  defaultValue,
  label,
  controllerProps,
  options: optionsFromProps,
  required,
}: ControlledSingleSelectProps<V, E, T>) => {
  const options = useMemo(() => {
    const opts: SelectOption[] = [];

    if (!required) {
      opts.push({ label: 'None', value: '' });
    }

    optionsFromProps.forEach((option) => {
      opts.push(
        typeof option === 'string' || typeof option === 'number'
          ? { label: option.toString(), value: option }
          : option,
      );
    });

    return opts;
  }, [optionsFromProps, required]);

  return (
    <TypedController
      control={control}
      fieldName={fieldName}
      defaultValue={defaultValue || ''}
      required={required}
      render={({ field }) => {
        return (
          <TextField
            {...field}
            value={field?.value || ''}
            error={!!fieldErr}
            helperText={fieldErr?.message?.toString()}
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
      {...(controllerProps ?? {})}
    />
  );
};
