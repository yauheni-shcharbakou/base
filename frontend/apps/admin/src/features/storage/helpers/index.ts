import { ONE_KB_BYTES, ONE_MB_BYTES } from '@/common/constants';
import { TextFieldProps } from '@mui/material';
import { BrowserStorage } from '@packages/proto';

export const getFileSize = (sizeInBytes = 0): string => {
  if (!sizeInBytes) {
    return '0 KB';
  }

  if (sizeInBytes > ONE_MB_BYTES) {
    return `${(sizeInBytes / ONE_MB_BYTES).toFixed(2)} MB`;
  }

  return `${(sizeInBytes / ONE_KB_BYTES).toFixed(2)} KB`;
};

const colorByUploadStatus = new Map<BrowserStorage.FileUploadStatus, TextFieldProps['color']>([
  [BrowserStorage.FileUploadStatus.READY, 'success'],
  [BrowserStorage.FileUploadStatus.FAILED, 'error'],
  [BrowserStorage.FileUploadStatus.PENDING, 'warning'],
]);

export const getFileUploadStatusColor = (status?: BrowserStorage.FileUploadStatus) => {
  if (!status) {
    return;
  }

  return colorByUploadStatus.get(status);
};
