'use client';

import { FieldErr } from '@/common/types';
import { getFileSize } from '@/features/storage/helpers';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import React, { useCallback, MouseEvent, ReactNode } from 'react';
import { Control, Controller, FieldValues } from 'react-hook-form';
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

export const StorageUploader = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldName,
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
}: StorageUploaderProps<V, E, T>) => {
  const maxFileSize = getFileSize(dropzoneProps?.maxSize);
  const selectLabel = multi ? 'Select files' : 'Select file';
  const removeLabel = multi ? 'Remove files' : 'Remove file';
  const hasSelection = !!(multi ? selected?.length : selected?.name);

  return (
    <Controller
      control={control as Control}
      name={fieldName as string}
      rules={{ required: required ? selectLabel : undefined }}
      render={({ field }) => {
        const onDrop = useCallback(
          (acceptedFiles: File[]) => {
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
          },
          [field, onChange, multi],
        );

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
          onDrop,
          disabled: disabled || isUploading,
          maxFiles,
          noClick: hasSelection,
          ...(dropzoneProps ?? {}),
        });

        const getDragLabel = useCallback(() => {
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
        }, [multi, isDragActive, hasSelection, selected, required]);

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
              <Typography
                fontWeight="bold"
                color={disabled ? 'textDisabled' : 'info'}
                align="center"
              >
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
      }}
    />
  );
};
