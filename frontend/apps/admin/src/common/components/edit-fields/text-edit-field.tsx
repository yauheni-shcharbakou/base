'use client';

import {
  combineControllerRules,
  EditFieldControllerProps,
} from '@/common/components/edit-fields/helpers';
import { TextField } from '@mui/material';
import { TextFieldProps } from '@mui/material/TextField/TextField';
import React, { FC, HTMLInputTypeAttribute } from 'react';
import {
  Controller,
  FieldErrors,
  UseFormRegisterReturn,
  UseFormReturn,
  Control,
  FieldValues,
} from 'react-hook-form';

type FieldProps = Omit<
  TextFieldProps,
  'type' | 'required' | 'label' | 'error' | 'helperText' | 'defaultValue'
>;

type TextEditFieldProps = {
  fieldError?: FieldErrors[string];
  type?: HTMLInputTypeAttribute;
  label?: string;
  value?: string;
  register: UseFormRegisterReturn;
  fieldProps?: FieldProps;
};

export const TextEditField: FC<TextEditFieldProps> = ({
  register,
  fieldError,
  type,
  label,
  value,
  fieldProps,
}: TextEditFieldProps) => {
  const required = !!register?.required;

  return (
    <TextField
      {...register}
      error={!!fieldError}
      helperText={fieldError?.message?.toString()}
      margin="normal"
      fullWidth
      type={type || 'text'}
      label={label}
      slotProps={{
        inputLabel: {
          shrink: !!value,
        },
      }}
      required={required}
      {...fieldProps}
    />
  );
};

type ControlledTextFieldProps<V extends FieldValues = FieldValues, E = any, T = V> = Pick<
  UseFormReturn<V, E, T>,
  'control'
> & {
  formField: string;
  fieldError?: FieldErrors[string];
  fieldProps?: FieldProps;
  type?: HTMLInputTypeAttribute;
  label?: string;
  defaultValue?: string;
  controllerProps?: EditFieldControllerProps;
  required?: boolean;
};

export const ControlledTextField = <V extends FieldValues, E = any, T = V>({
  control,
  formField,
  fieldError,
  fieldProps,
  type,
  label,
  defaultValue,
  controllerProps,
  required,
}: ControlledTextFieldProps<V, E, T>) => {
  return (
    <Controller
      control={control as Control}
      name={formField}
      defaultValue={defaultValue || ''}
      render={({ field }) => (
        <TextField
          {...field}
          error={!!fieldError}
          helperText={fieldError?.message?.toString()}
          margin="normal"
          fullWidth
          type={type || 'text'}
          label={label}
          required={required}
          {...fieldProps}
        />
      )}
      {...combineControllerRules(controllerProps, required)}
    />
  );
};
