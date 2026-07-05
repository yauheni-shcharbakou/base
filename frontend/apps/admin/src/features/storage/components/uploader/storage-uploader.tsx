'use client';

import { FieldErr } from '@/common/types';
import { getFileSize } from '@/features/storage/helpers';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import React, { MouseEvent, ReactNode } from 'react';
import { Control, Controller, ControllerRenderProps, FieldValues } from 'react-hook-form';
import { DropzoneOptions, useDropzone } from 'react-dropzone';

type CommonProps<V extends FieldValues = FieldValues, E = any, T = V> = {
  control?: Control<V, E, T>;
  fieldName: keyof V & string;
  dropzoneProps?: Omit<DropzoneOptions, 'maxFiles'>;
  children: ReactNode;
  fieldErr?: FieldErr;
  disabled?: boolean;
  required?: boolean;
  isUploading: boolean;
  allowedTypes?: string[];
};

type DynamicProps =
  | {
      multi: false;
      maxFiles: 1;
      onChange?: (file?: File) => void;
      selected?: File;
    }
  | {
      multi: true;
      maxFiles?: number;
      onChange?: (files?: File[]) => void;
      selected?: File[];
    };

export type StorageUploaderProps<V extends FieldValues = FieldValues, E = any, T = V> = CommonProps<
  V,
  E,
  T
> &
  DynamicProps;

// Keep DynamicProps as a union (do not Omit over the union, or the multi/selected
// discrimination is lost) so `multi` still narrows `selected`/`onChange`.
type DropzoneFieldProps<V extends FieldValues = FieldValues, E = any, T = V> = Omit<
  CommonProps<V, E, T>,
  'control' | 'fieldName'
> &
  DynamicProps & {
    field: ControllerRenderProps;
  };

// Hooks (useDropzone) must live at the top level of a component, not inside a
// Controller `render` callback — so the field render body is extracted here.
const DropzoneField = <V extends FieldValues = FieldValues, E = any, T = V>({
  field,
  dropzoneProps,
  children,
  fieldErr,
  selected,
  multi,
  maxFiles,
  isUploading,
  onChange,
  disabled,
  required,
  allowedTypes,
}: DropzoneFieldProps<V, E, T>) => {
  const maxFileSize = getFileSize(dropzoneProps?.maxSize);
  const selectLabel = multi ? 'Select files' : 'Select file';
  const removeLabel = multi ? 'Remove files' : 'Remove file';
  const hasSelection = !!(multi ? selected?.length : selected?.name);

  const onDrop = (acceptedFiles: File[]) => {
    if (!multi) {
      const file = acceptedFiles[0];

      if (!file) {
        return;
      }

      field.onChange(file);
      onChange?.(file);
      return;
    }

    if (!acceptedFiles.length) {
      return;
    }

    field.onChange(acceptedFiles);
    onChange?.(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isUploading,
    maxFiles,
    noClick: hasSelection,
    ...(dropzoneProps ?? {}),
  });

  const getDragLabel = () => {
    const requiredLabel = required ? '*' : '';

    if (multi) {
      if (hasSelection) {
        return `Files selected: ${selected!.length + requiredLabel}`;
      }

      if (isDragActive) {
        return 'Drag files here...';
      }

      return `Drag & drop or click to select files${requiredLabel}`;
    }

    if (hasSelection) {
      return `${selected!.name}, ${getFileSize(selected!.size) + requiredLabel}`;
    }

    if (isDragActive) {
      return 'Drag file here...';
    }

    return `Drag & drop or click to select file${requiredLabel}`;
  };

  const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    field.onChange(undefined);
    onChange?.();
  };

  return (
    <Card
      {...getRootProps()}
      variant={isDragActive ? 'elevation' : 'outlined'}
      elevation={isDragActive ? 1 : 0}
      sx={{
        p: 2,
        borderStyle: isDragActive ? 'dashed' : 'solid',
        borderWidth: '1px',
        transition: 'all 0.2s ease',
        cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
      }}
    >
      <input {...getInputProps()} />{' '}
      <Stack gap={2} alignItems="center">
        <Typography fontWeight="bold" color={disabled ? 'textDisabled' : 'info'} align="center">
          {getDragLabel()}
        </Typography>
        <Stack width={1}>
          {dropzoneProps?.maxSize && (
            <Typography variant="caption" color="textSecondary" align="center">
              Max size: {maxFileSize}
            </Typography>
          )}
          {allowedTypes?.length && (
            <Typography variant="caption" color="textSecondary" align="center">
              Allowed types: {allowedTypes.join(' / ')}
            </Typography>
          )}
          {!disabled && fieldErr && (
            <Typography variant="caption" color="error" align="center">
              {fieldErr.message?.toString() || 'File problems'}
            </Typography>
          )}
        </Stack>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
          {!hasSelection ? (
            <Button
              variant="outlined"
              color="primary"
              disabled={disabled || isUploading || hasSelection}
            >
              {selectLabel}
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="error"
              onClick={handleClear}
              disabled={disabled || isUploading || !hasSelection}
            >
              {removeLabel}
            </Button>
          )}
        </Box>
        {children}
      </Stack>
    </Card>
  );
};

export const StorageUploader = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldName,
  ...rest
}: StorageUploaderProps<V, E, T>) => {
  return (
    <Controller
      control={control as Control}
      name={fieldName as string}
      rules={{
        required: rest.required ? (rest.multi ? 'Select files' : 'Select file') : undefined,
      }}
      render={({ field }) => <DropzoneField<V, E, T> field={field} {...rest} />}
    />
  );
};
