import { ONE_KB_BYTES, ONE_MB_BYTES } from '@/common/constants';

export const getFileSize = (sizeInBytes = 0): string => {
  if (!sizeInBytes) {
    return '0 KB';
  }

  if (sizeInBytes > ONE_MB_BYTES) {
    return `${(sizeInBytes / ONE_MB_BYTES).toFixed(2)} MB`;
  }

  return `${(sizeInBytes / ONE_KB_BYTES).toFixed(2)} KB`;
};
