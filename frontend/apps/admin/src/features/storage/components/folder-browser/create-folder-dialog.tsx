'use client';

import { getErrorMessage } from '@/common/helpers';
import { useReplacingNotification } from '@/common/hooks';
import { useCreateFolder } from '@/features/storage/hooks';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import React, { FC, FormEvent, useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  userId: string;
  // The folder the new one is made in.
  parent: string;
  onClose: () => void;
};

const DEFAULT_NAME = 'Untitled folder';

/**
 * Drive's "New folder": a name, ready to type over, applied on Enter. The folder takes its
 * visibility from the one it is made in — the service decides it. A name taken there is refused by
 * the backend (409) and shown on the field, with any other refusal; the dialog stays open for
 * another try. Its paper keeps the page's shortcuts off its keys (`data-keeps-keys`).
 */
export const CreateFolderDialog: FC<Props> = ({ open, userId, parent, onClose }) => {
  const creation = useCreateFolder();
  const notify = useReplacingNotification();
  const [name, setName] = useState(DEFAULT_NAME);
  const inputRef = useRef<HTMLInputElement>(null);
  const { reset } = creation;

  useEffect(() => {
    if (open) {
      setName(DEFAULT_NAME);
      reset();
    }
  }, [open, reset]);

  const trimmed = name.trim();
  const isInvalid = trimmed.includes('/');
  const canSave = !!trimmed && !isInvalid;
  const error = isInvalid
    ? 'A name cannot contain “/”'
    : creation.error && getErrorMessage(creation.error);

  const close = () => !creation.isPending && onClose();

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (canSave && !creation.isPending) {
      creation.mutate(
        { userId, parent, name: trimmed },
        {
          onSuccess: (created) => {
            // It may land on another page of the listing.
            notify({
              type: 'success',
              message: `Folder “${created.name}” created`,
              key: 'storage-folder-create',
            });
            onClose();
          },
        },
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="xs"
      fullWidth
      aria-labelledby="create-folder-title"
      slotProps={{
        paper: { component: 'form', onSubmit: submit, 'data-keeps-keys': '' } as object,
        // Once in: the menu that asked for the dialog hands the focus back to its button as it
        // closes, which would win over `autoFocus`.
        transition: {
          onEntered: () => {
            inputRef.current?.focus();
            inputRef.current?.select();
          },
        },
      }}
    >
      <DialogTitle id="create-folder-title">New folder</DialogTitle>
      <DialogContent>
        <TextField
          inputRef={inputRef}
          value={name}
          onChange={(event) => {
            setName(event.target.value);

            if (creation.error) {
              reset();
            }
          }}
          disabled={creation.isPending}
          error={!!error}
          helperText={error || ' '}
          fullWidth
          size="small"
          margin="dense"
          slotProps={{ htmlInput: { 'aria-label': 'Folder name' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={creation.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSave || creation.isPending}
          startIcon={
            creation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
