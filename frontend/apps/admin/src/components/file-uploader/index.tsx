'use client';

import { getFileSize } from '@/helpers/file.helpers';
import { Box, Button, Card, LinearProgress, Stack, Typography } from '@mui/material';
import React, { FC, useEffect, useState, useCallback, MouseEvent } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';

type Props = Pick<UseFormReturn<any>, 'control' | 'watch'> & {
  formField: string;
  errors: FieldErrors<any>;
  onChange?: (file?: File) => void;
  disabled?: boolean;
  required?: boolean;
  maxSize?: number;
  types?: string[];
  progress?: number;
  isUploading?: boolean;
};

export const FileUploader: FC<Props> = ({
  control,
  watch,
  formField,
  errors,
  progress,
  isUploading,
  onChange,
  disabled,
  required,
  maxSize,
  types,
}: Props) => {
  const selectedFile = watch(formField) as File;
  const [fileSize, setFileSize] = useState('');

  const maxFileSize = getFileSize(maxSize);

  useEffect(() => {
    setFileSize(() => getFileSize(selectedFile?.size));
  }, [selectedFile]);

  return (
    <Controller
      control={control}
      name={formField}
      rules={{ required: required ? 'Select file' : undefined }}
      render={({ field }) => {
        const onDrop = useCallback(
          (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];

            if (!file) {
              return;
            }

            field.onChange(file);
            onChange?.(file);
          },
          [field, onChange],
        );

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
          onDrop,
          disabled: disabled || isUploading,
          maxFiles: 1,
          accept: types?.length ? Object.fromEntries(types.map((t) => [t, []])) : undefined,
          noClick: !!selectedFile,
          maxSize,
        });

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
                {isDragActive
                  ? 'Drop the file here...'
                  : selectedFile?.name
                    ? `${selectedFile.name}, ${fileSize}`
                    : 'Drag & drop or click to select file'}
                {required ? '*' : ''}
              </Typography>
              <Stack width={1}>
                {maxSize && (
                  <Typography variant="caption" color="textSecondary" align="center">
                    Max size: {maxFileSize}
                  </Typography>
                )}
                {types?.length && (
                  <Typography variant="caption" color="textSecondary" align="center">
                    Allowed types: {types.join(', ')}
                  </Typography>
                )}
                {!disabled && errors[formField] && (
                  <Typography variant="caption" color="error" align="center">
                    {errors[formField].message?.toString() || 'Problem with file'}
                  </Typography>
                )}
              </Stack>
              <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
                {!selectedFile ? (
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={disabled || isUploading || !!selectedFile}
                  >
                    Select file
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleClear}
                    disabled={disabled || isUploading || !selectedFile}
                  >
                    Remove file
                  </Button>
                )}
              </Box>
              {isUploading && (
                <Box width={1}>
                  {progress && progress >= 100 ? (
                    <>
                      <Typography variant="body2" color="info" align="center" sx={{ mb: 1, mt: 1 }}>
                        Saving...
                      </Typography>
                      <LinearProgress variant="indeterminate" />
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" color="info" align="center" sx={{ mb: 1, mt: 1 }}>
                        {progress?.toFixed(2)} %
                      </Typography>
                      <LinearProgress variant="determinate" value={progress} />
                    </>
                  )}
                </Box>
              )}
            </Stack>
          </Card>
        );
      }}
    />
  );
};
