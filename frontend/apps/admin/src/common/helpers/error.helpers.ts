import { AxiosError } from 'axios';

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'details' in error &&
    typeof error.details === 'string'
  ) {
    return error.details;
  }

  return error instanceof Error ? error.message : 'Unknown error';
};
