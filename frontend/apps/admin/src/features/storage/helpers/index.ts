import { TextFieldProps } from '@mui/material';
import { BrowserStorage } from '@packages/proto';

export * from './file-kind';
export * from './file-size';
export * from './folder-content-params';
export * from './folder-item-target';
export * from './folder-preferences';
export * from './folder-selection';
export * from './folder-stats';
export * from './folder-tree';
export * from './gallery-navigation';
export * from './marquee';
export * from './media-options';
export * from './moved-items';
export * from './name-conflict';
export * from './pdf-view';
export * from './presigned-upload';
export * from './shortcut-key';
export * from './shortcut-label';
export * from './storage-meta.schema';
export * from './upload-queue';
export * from './upload-replace';
export * from './upload-rules';
export * from './upload-tree';
export * from './visibility-lock';

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
