'use client';

import { createOne, deleteOne, getList, getOne, updateOne } from '@/actions/data.actions';
import { DataProvider } from '@refinedev/core';
import dataProviderSimpleRest from '@refinedev/simple-rest';

const API_URL = 'https://api.fake-rest.refine.dev';

export const dataProvider = dataProviderSimpleRest(API_URL);

export const grpcProvider: DataProvider = {
  create: createOne,
  deleteOne,
  getApiUrl: (): string => '',
  getOne,
  update: updateOne,
  getList,
};
