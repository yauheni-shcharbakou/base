'use client';

import {
  EditFieldControllerProps,
  TypedController,
} from '@/common/components/edit-fields/wrappers';
import { FieldErr } from '@/common/types';
import { TextField } from '@mui/material';
import { TextFieldProps } from '@mui/material/TextField/TextField';
import React, { FC, HTMLInputTypeAttribute } from 'react';
import { Control, FieldValues, UseFormRegisterReturn } from 'react-hook-form';

type FieldProps = Omit<
  TextFieldProps,
  'type' | 'required' | 'label' | 'error' | 'helperText' | 'defaultValue'
>;

type TextEditFieldProps = {
  fieldErr?: FieldErr;
  type?: HTMLInputTypeAttribute;
  label?: string;
  value?: string;
  register: UseFormRegisterReturn;
  fieldProps?: FieldProps;
};

export const TextEditField: FC<TextEditFieldProps> = ({
  register,
  fieldErr,
  type,
  label,
  value,
  fieldProps,
}) => {
  const required = !!register?.required;

  return (
    <TextField
      {...register}
      error={!!fieldErr}
      helperText={fieldErr?.message?.toString()}
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

type ControlledTextFieldProps<V extends FieldValues = FieldValues, E = any, T = V> = {
  control?: Control<V, E, T>;
  fieldName: keyof V & string;
  fieldErr?: FieldErr;
  type?: HTMLInputTypeAttribute;
  label?: string;
  defaultValue?: string;
  controllerProps?: EditFieldControllerProps;
  required?: boolean;
};

export const ControlledTextField = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldErr,
  type,
  label,
  defaultValue,
  controllerProps,
  required,
  fieldName,
}: ControlledTextFieldProps<V, E, T>) => {
  return (
    <TypedController
      control={control}
      fieldName={fieldName}
      defaultValue={defaultValue || ''}
      required={required}
      render={({ field }) => (
        <TextField
          {...field}
          error={!!fieldErr}
          helperText={fieldErr?.message?.toString()}
          margin="normal"
          fullWidth
          type={type || 'text'}
          label={label}
          required={required}
        />
      )}
      {...(controllerProps ?? {})}
    />
  );
};
