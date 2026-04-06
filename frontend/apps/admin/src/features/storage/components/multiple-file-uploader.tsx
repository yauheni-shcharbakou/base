'use client';

import { getFileSize } from '@/features/storage/helpers';
import { FileUploadItem } from '@/features/storage/hooks';
import { Delete } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  Stack,
  Typography,
  List as MuiList,
  ListItem,
  IconButton,
  LinearProgress,
} from '@mui/material';
import React, { useCallback, MouseEvent } from 'react';
import { Controller, FieldErrors, FieldValues, UseFormReturn, Path } from 'react-hook-form';
import { Accept, useDropzone } from 'react-dropzone';

export type MultipleFileUploaderProps<V extends FieldValues = FieldValues, E = any, T = V> = Pick<
  UseFormReturn<V, E, T>,
  'control' | 'watch'
> & {
  formField: Path<V>;
  errors: FieldErrors<any>;
  onChange?: (files?: File[]) => void;
  disabled?: boolean;
  required?: boolean;
  maxSize?: number;
  isUploading?: boolean;
  accept?: Accept;
  allowedTypes?: string[];
  max?: number;
  onDelete?: (id: string) => void;
  failedItems: FileUploadItem[];
  uploadedCount: number;
  itemsCount: number;
};

type ListProps = Pick<MultipleFileUploaderProps, 'failedItems' | 'onDelete' | 'isUploading'>;

type FailedItemProps = {
  uploadItem: FileUploadItem;
  onDelete?: (id: string) => void;
  frozen?: boolean;
};

const FailedItem = React.memo(({ uploadItem, onDelete, frozen }: FailedItemProps) => {
  return (
    <ListItem
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="body2" color="warning" sx={{ flexGrow: 1 }}>
          {uploadItem.file.name} ({getFileSize(uploadItem.file.size)})
        </Typography>

        <IconButton
          size="small"
          onClick={() => onDelete?.(uploadItem.id)}
          color="error"
          disabled={frozen}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Stack>
    </ListItem>
  );
});

const FailedItemsList = React.memo(({ failedItems, onDelete, isUploading }: ListProps) => {
  if (failedItems.length === 0) {
    return null;
  }

  return (
    <MuiList sx={{ mt: 2, width: 1 }}>
      {failedItems.map((item) => (
        <FailedItem key={item.id} uploadItem={item} onDelete={onDelete} frozen={isUploading} />
      ))}
    </MuiList>
  );
});

export const MultipleFileUploader = <V extends FieldValues, E = any, T = V>({
  control,
  watch,
  formField,
  errors,
  isUploading,
  onChange,
  disabled,
  required,
  maxSize,
  allowedTypes,
  accept,
  max,
  failedItems,
  onDelete,
  itemsCount,
  uploadedCount,
}: MultipleFileUploaderProps<V, E, T>) => {
  const selectedFiles = watch(formField) as unknown as File[];
  const maxFileSize = getFileSize(maxSize);

  return (
    <Controller
      control={control}
      name={formField}
      rules={{ required: required ? 'Select files' : undefined }}
      render={({ field }) => {
        const onDrop = useCallback(
          (acceptedFiles: File[]) => {
            if (!acceptedFiles.length) {
              return;
            }

            field.onChange(acceptedFiles);
            onChange?.(acceptedFiles);
          },
          [field.onChange, onChange],
        );

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
          onDrop,
          disabled: disabled || isUploading,
          maxFiles: max,
          accept,
          noClick: !!selectedFiles,
          maxSize,
        });

        const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
          e?.stopPropagation();
          field.onChange([]);
          onChange?.([]);
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
                {selectedFiles?.length
                  ? `Files selected: ${selectedFiles.length}`
                  : 'Drag & drop or click to select files'}
                {required ? '*' : ''}
              </Typography>
              <Stack width={1}>
                {maxSize && (
                  <Typography variant="caption" color="textSecondary" align="center">
                    Max size: {maxFileSize}
                  </Typography>
                )}
                {allowedTypes?.length && (
                  <Typography variant="caption" color="textSecondary" align="center">
                    Allowed types: {allowedTypes.join(' / ')}
                  </Typography>
                )}
                {!disabled && errors[formField] && (
                  <Typography variant="caption" color="error" align="center">
                    {errors[formField].message?.toString() || 'Problem with files'}
                  </Typography>
                )}
              </Stack>
              <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
                {!selectedFiles?.length ? (
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={disabled || isUploading || !!selectedFiles?.length}
                  >
                    Select files
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleClear}
                    disabled={disabled || isUploading || !selectedFiles?.length}
                  >
                    Remove files
                  </Button>
                )}
              </Box>

              {isUploading && (
                <Box width={1}>
                  <Typography variant="body2" color="info" align="center" sx={{ mb: 1, mt: 1 }}>
                    {uploadedCount} / {itemsCount}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(uploadedCount / itemsCount) * 100}
                  />
                </Box>
              )}

              <FailedItemsList
                failedItems={failedItems}
                onDelete={onDelete}
                isUploading={isUploading}
              />
            </Stack>
          </Card>
        );
      }}
    />
  );
};
