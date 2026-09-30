import { ONE_KB_BYTES, ONE_MB_BYTES } from '@/common/constants';
import { TextFieldProps } from '@mui/material';
import { BrowserStorage } from '@packages/proto';

export * from './file-kind';
export * from './folder-content-params';
export * from './folder-item-target';
export * from './folder-preferences';
export * from './folder-selection';
export * from './folder-tree';
export * from './gallery-navigation';
export * from './marquee';
export * from './media-options';
export * from './moved-items';
export * from './name-conflict';
export * from './presigned-upload';
export * from './storage-batch';
export * from './storage-meta.schema';
export * from './upload-queue';
export * from './upload-rules';

export const getFileSize = (sizeInBytes = 0): string => {
  if (!sizeInBytes) {
    return '0 KB';
  }

  if (sizeInBytes > ONE_MB_BYTES) {
    return `${(sizeInBytes / ONE_MB_BYTES).toFixed(2)} MB`;
  }

  return `${(sizeInBytes / ONE_KB_BYTES).toFixed(2)} KB`;
};

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatDateTime = (date?: Date | string): string =>
  date ? dateTimeFormat.format(new Date(date)) : '—';

// A Record, not a Map: a Map lookup misses silently, so the member added before this one rendered
// colourless with nothing to catch it. This shape makes the compiler demand every status.
const colorByUploadStatus: Record<BrowserStorage.FileUploadStatus, TextFieldProps['color']> = {
  [BrowserStorage.FileUploadStatus.READY]: 'success',
  // In progress and nothing wrong — `warning` already means "not done and possibly stuck", which
  // is what UPLOADED is not.
  [BrowserStorage.FileUploadStatus.UPLOADED]: 'info',
  [BrowserStorage.FileUploadStatus.FAILED]: 'error',
  [BrowserStorage.FileUploadStatus.PENDING]: 'warning',
};

export const getFileUploadStatusColor = (status?: BrowserStorage.FileUploadStatus) => {
  if (!status) {
    return;
  }

  return colorByUploadStatus[status];
};
