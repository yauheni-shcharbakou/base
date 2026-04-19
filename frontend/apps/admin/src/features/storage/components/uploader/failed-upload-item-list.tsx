import { getFileSize } from '@/features/storage/helpers';
import { StorageUploadItem } from '@/features/storage/types';
import { Delete } from '@mui/icons-material';
import { IconButton, List as MuiList, ListItem, Stack, Typography } from '@mui/material';
import React from 'react';

type FailedItemProps = {
  uploadItem: StorageUploadItem;
  onDelete?: (uploadId: string) => void;
  frozen: boolean;
};

const FailedItem = React.memo<FailedItemProps>(({ uploadItem, onDelete, frozen }) => {
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
          onClick={() => onDelete?.(uploadItem.uploadId)}
          color="error"
          disabled={frozen}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Stack>
    </ListItem>
  );
});

type FailedItemsListProps = {
  failedItems: StorageUploadItem[];
  onDelete?: (uploadId: string) => void;
  isUploading: boolean;
};

export const FailedItemsList = React.memo<FailedItemsListProps>(
  ({ failedItems, onDelete, isUploading }) => {
    if (!failedItems.length) {
      return null;
    }

    return (
      <MuiList sx={{ mt: 2, width: 1 }}>
        {failedItems.map((failedItem) => (
          <FailedItem
            key={failedItem.uploadId}
            uploadItem={failedItem}
            onDelete={onDelete}
            frozen={isUploading}
          />
        ))}
      </MuiList>
    );
  },
);
