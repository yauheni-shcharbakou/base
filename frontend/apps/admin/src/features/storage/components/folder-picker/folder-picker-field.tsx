'use client';

import { TypedController } from '@/common/components/edit-fields/wrappers/typed-controller';
import { FieldErr } from '@/common/types';
import { getFolderLabel } from '@/features/storage/helpers';
import { useRootFolderLabel, useUserFolders } from '@/features/storage/hooks';
import ClearRounded from '@mui/icons-material/ClearRounded';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import React, { KeyboardEvent, useState } from 'react';
import { Control, FieldValues } from 'react-hook-form';
import { FolderPickerDialog } from './folder-picker-dialog';

type Props<V extends FieldValues = FieldValues, E = any, T = V> = {
  control?: Control<V, E, T>;
  fieldName: keyof V & string;
  fieldErr?: FieldErr;
  label?: string;
  required?: boolean;
  // Whose folders to pick from; the field is disabled until there is an owner.
  userId?: string;
  // Folders the value may not be, with everything under them — the edited folder itself.
  blockedIds?: string[];
};

/**
 * A form's folder, picked the way Drive's "Move to" picks one: the field shows the folder's path and
 * opens the picker. Holds the folder's id. Without `required` it can be cleared.
 */
export const FolderPickerField = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldName,
  fieldErr,
  label = 'Folder',
  required,
  userId,
  blockedIds,
}: Props<V, E, T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const folders = useUserFolders(userId);
  const rootLabel = useRootFolderLabel(userId);

  const open = () => userId && setIsOpen(true);

  return (
    <TypedController
      control={control}
      fieldName={fieldName}
      defaultValue=""
      required={required}
      render={({ field }) => {
        const value = (field.value as string | undefined) || '';
        const folder = folders.data?.find(({ id }) => id === value);
        const text = folder ? getFolderLabel(folder, rootLabel) : value ? '…' : '';

        return (
          <>
            <TextField
              name={field.name}
              inputRef={field.ref}
              value={text}
              label={label}
              placeholder="Not in a folder"
              required={required}
              disabled={!userId}
              error={!!fieldErr}
              helperText={fieldErr?.message?.toString()}
              fullWidth
              margin="normal"
              onClick={open}
              onBlur={field.onBlur}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  open();
                }
              }}
              slotProps={{
                input: {
                  readOnly: true,
                  sx: { cursor: 'pointer', '& input': { cursor: 'pointer' } },
                  endAdornment: (
                    <InputAdornment position="end">
                      {!required && value && (
                        <IconButton
                          size="small"
                          aria-label="Clear folder"
                          onClick={(event) => {
                            event.stopPropagation();
                            field.onChange('');
                          }}
                        >
                          <ClearRounded fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label="Choose folder"
                        disabled={!userId}
                        onClick={(event) => {
                          event.stopPropagation();
                          open();
                        }}
                      >
                        <FolderOpenOutlined fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
                inputLabel: { shrink: true },
              }}
            />
            {userId && (
              <FolderPickerDialog
                open={isOpen}
                title={`Choose ${label.toLowerCase()}`}
                userId={userId}
                initialPickedId={value || undefined}
                blockedIds={blockedIds}
                confirmLabel="Select"
                onCancel={() => setIsOpen(false)}
                onConfirm={(picked) => {
                  field.onChange(picked.id);
                  setIsOpen(false);
                }}
              />
            )}
          </>
        );
      }}
    />
  );
};
