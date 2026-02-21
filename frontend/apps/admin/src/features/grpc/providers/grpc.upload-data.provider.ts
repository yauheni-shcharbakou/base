'use client';

import { grpcDataProvider } from '@/features/grpc/providers/grpc.data.provider';
import { CreateParams, DataProvider } from '@refinedev/core';

export const grpcUploadDataProvider: DataProvider = {
  ...grpcDataProvider,
  getApiUrl: (): string => '/api',
  create: async (params: CreateParams<any>) => {
    return params.variables;
  },
};
