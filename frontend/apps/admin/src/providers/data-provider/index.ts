'use client';

import { createOne, deleteOne, getList, getOne, updateOne } from '@/actions/data.actions';
import {
  CreateParams,
  DataProvider,
  DeleteOneParams,
  GetOneParams,
  UpdateParams,
} from '@refinedev/core';
import dataProviderSimpleRest from '@refinedev/simple-rest';

const API_URL = 'https://api.fake-rest.refine.dev';

export const httpDataProvider = dataProviderSimpleRest(API_URL);

export const grpcDataProvider: DataProvider = {
  getApiUrl: (): string => '',
  getOne: async (params: GetOneParams) => {
    return getOne<any>({ resource: params.resource, id: params.id.toString() });
  },
  getList,
  create: async (params: CreateParams<any>) => {
    return createOne<any>({ resource: params.resource, create: params.variables });
  },
  update: async (params: UpdateParams<any>) => {
    return updateOne<any>({
      resource: params.resource,
      id: params.id.toString(),
      update: { set: params.variables },
    });
  },
  deleteOne: async (params: DeleteOneParams<any>) => {
    return deleteOne<any>({ resource: params.resource, id: params.id.toString() });
  },
};

export const uploadDataProvider: DataProvider = {
  ...grpcDataProvider,
  getApiUrl: (): string => '/api',
  create: async (params: CreateParams<any>) => {
    return params.variables;
  },
};
