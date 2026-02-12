'use client';

import { getFileSize } from '@/helpers/file.helpers';
import { Box, Button, Card, LinearProgress, Typography } from '@mui/material';
import React, { ChangeEvent, FC, useEffect, useState } from 'react';
import { Controller, ControllerRenderProps, FieldErrors, UseFormReturn } from 'react-hook-form';

type Props = Pick<UseFormReturn<any>, 'control' | 'watch'> & {
  formField: string;
  errors: FieldErrors<any>;
  progress?: number;
  isUploading?: boolean;
  onChange?: (file?: File) => void;
  disabled?: boolean;
};

export const Uploader: FC<Props> = ({
  control,
  watch,
  formField,
  errors,
  progress,
  isUploading,
  onChange,
  disabled,
}: Props) => {
  const selectedFile = watch(formField) as File;
  const [fileSize, setFileSize] = useState('');

  useEffect(() => {
    setFileSize(() => getFileSize(selectedFile?.size));
  }, [selectedFile]);

  const handleFileChange = (field: ControllerRenderProps) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file) {
        field.onChange(file);
        onChange?.(file);
      }
    };
  };

  const clearFile = (field: ControllerRenderProps) => {
    return () => {
      field.onChange(undefined);
      onChange?.();
    };
  };

  return (
    <Card
      variant="outlined"
      sx={{ pl: 2, pr: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Typography
        fontWeight="bold"
        color={disabled ? 'textDisabled' : 'info'}
        sx={{ mb: 2, mt: 2 }}
      >
        {selectedFile?.name ? `File: ${selectedFile.name}, ${fileSize}` : 'File not selected'}
      </Typography>
      {!disabled && errors[formField] && (
        <Typography variant="caption" color="error" sx={{ mb: 2, mt: 2, flexGrow: 1 }}>
          {errors[formField].message?.toString() || 'Problem with file'}
        </Typography>
      )}
      <Controller
        control={control}
        name="file"
        rules={{ required: 'Select file' }}
        disabled={disabled || isUploading}
        render={({ field }) => (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 2,
              mb: 2,
              mt: 2,
            }}
          >
            <Button
              variant="outlined"
              component="label"
              color="primary"
              disabled={disabled || isUploading || !!selectedFile}
            >
              Select file
              <input type="file" hidden onChange={handleFileChange(field)} />
            </Button>
            <Button
              variant="outlined"
              component="label"
              color="error"
              onClick={clearFile(field)}
              disabled={disabled || isUploading || !selectedFile}
            >
              Remove file
            </Button>
          </Box>
        )}
      />
      {isUploading && (
        <Box sx={{ mb: 2 }} width={1}>
          <Typography variant="body2" color="info" align="center" sx={{ mb: 1, mt: 1 }}>
            {progress} %
          </Typography>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}
    </Card>
  );
};
