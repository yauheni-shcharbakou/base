'use client';

import { createOne, deleteOne, getList, getOne, updateOne } from '@/features/grpc/actions';
import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import {
  CreateParams,
  DataProvider,
  DeleteOneParams,
  GetListParams,
  GetOneParams,
  UpdateParams,
} from '@refinedev/core';

// Every action returns its failure as a value (`ActionResult`); it is thrown again here, so Refine
// gets the `HttpError` its notifications and `useForm` read.
export const grpcDataProvider: DataProvider = {
  getApiUrl: (): string => '/api',
  getOne: async (params: GetOneParams) => {
    return unwrapActionResult(
      await getOne<any>({ resource: params.resource, id: params.id.toString() }),
    );
  },
  getList: async (params: GetListParams) => {
    return unwrapActionResult(await getList<any>(params));
  },
  create: async (params: CreateParams<any>) => {
    return unwrapActionResult(
      await createOne<any>({ resource: params.resource, create: params.variables }),
    );
  },
  update: async (params: UpdateParams<any>) => {
    return unwrapActionResult(
      await updateOne<any>({
        resource: params.resource,
        id: params.id.toString(),
        update: { set: params.variables },
      }),
    );
  },
  deleteOne: async (params: DeleteOneParams<any>) => {
    return unwrapActionResult(
      await deleteOne<any>({ resource: params.resource, id: params.id.toString() }),
    );
  },
};
