'use client';

import { grpcDataProvider } from '@/features/grpc/providers/grpc.data.provider';
import { CreateManyParams, CreateParams, DataProvider } from '@refinedev/core';

export const grpcUploadDataProvider: DataProvider = {
  ...grpcDataProvider,
  getApiUrl: (): string => '/api',
  create: async (params: CreateParams<any>) => {
    return { data: params.variables };
  },
  createMany: async (params: CreateManyParams<any>) => {
    return { data: params.variables };
  },
};
