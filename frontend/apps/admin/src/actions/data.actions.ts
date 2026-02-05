'use server';

import { getAuthMetadata } from '@/helpers/auth.helpers';
import { convertFilters, convertSorters, getRepository } from '@/helpers/data.helpers';
import {
  BaseRecord,
  CreateParams,
  CreateResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  UpdateParams,
  UpdateResponse,
  DeleteOneParams,
  DeleteOneResponse,
} from '@refinedev/core';

export async function getOne<Entity extends BaseRecord>(
  params: GetOneParams,
): Promise<GetOneResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);
  const entity = await repository.getById({ id: params.id.toString() }, metadata);
  return { data: entity };
}

export async function getList<Entity extends BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<Entity>> {
  try {
    const metadata = await getAuthMetadata();
    const repository = getRepository<Entity>(params.resource);

    const result = await repository.getList(
      {
        ...convertFilters(params.filters),
        sorters: convertSorters(params.sorters),
        pagination: {
          page: params.pagination?.currentPage,
          limit: params.pagination?.pageSize,
        },
      },
      metadata,
    );

    return { data: result.items, total: result.total };
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
    }

    return { data: [], total: 0 };
  }
}

export async function createOne<Entity extends BaseRecord, TVariables>(
  params: CreateParams<TVariables>,
): Promise<CreateResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);
  const entity = await repository.createOne(params.variables as Partial<Entity>, metadata);
  return { data: entity };
}

export async function updateOne<Entity extends BaseRecord, TVariables>(
  params: UpdateParams<TVariables>,
): Promise<UpdateResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);

  const entity = await repository.updateById(
    {
      id: params.id.toString(),
      update: { set: params.variables as Partial<Entity> },
    },
    metadata,
  );

  return { data: entity };
}

export async function deleteOne<Entity extends BaseRecord, TVariables>(
  params: DeleteOneParams<TVariables>,
): Promise<DeleteOneResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);
  const entity = await repository.deleteById({ id: params.id.toString() }, metadata);
  return { data: entity };
}
