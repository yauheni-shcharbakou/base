'use server';

import { grpcDataMapper } from '@/mappers';
import { authService, grpcDataService } from '@/services';
import { GrpcCreateOne, GrpcSingleEntityAction, GrpcUpdateOne } from '@/types/grpc.types';
import {
  BaseRecord,
  CreateResponse,
  GetListParams,
  GetListResponse,
  GetOneResponse,
  UpdateResponse,
  DeleteOneResponse,
} from '@refinedev/core';

export async function getOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcSingleEntityAction,
): Promise<GetOneResponse<Entity>> {
  const metadata = await authService.getAuthMetadata();

  const entity = await grpcDataService
    .getRepository<Entity>(request.resource)
    .getById({ id: request.id.toString() }, metadata);

  return { data: entity };
}

export async function getList<Entity extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<Entity>> {
  try {
    const metadata = await authService.getAuthMetadata();

    const result = await grpcDataService
      .getRepository<Entity>(params.resource)
      .getList(grpcDataMapper.convertGetListParams(params), metadata);

    return { data: result.items, total: result.total };
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
    }

    return { data: [], total: 0 };
  }
}

export async function createOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcCreateOne<Entity>,
): Promise<CreateResponse<Entity>> {
  const metadata = await authService.getAuthMetadata();

  const entity = await grpcDataService
    .getRepository<Entity>(request.resource)
    .createOne(request.create, metadata);

  return { data: entity };
}

export async function updateOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcUpdateOne<Entity>,
): Promise<UpdateResponse<Entity>> {
  const metadata = await authService.getAuthMetadata();

  const entity = await grpcDataService
    .getRepository<Entity>(request.resource)
    .updateById({ id: request.id.toString(), update: request.update }, metadata);

  return { data: entity };
}

export async function deleteOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcSingleEntityAction,
): Promise<DeleteOneResponse<Entity>> {
  const metadata = await authService.getAuthMetadata();

  const entity = await grpcDataService
    .getRepository<Entity>(request.resource)
    .deleteById({ id: request.id.toString() }, metadata);

  return { data: entity };
}
