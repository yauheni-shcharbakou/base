'use server';

import { authService } from '@/features/auth/services';
import { runAction } from '@/features/grpc/helpers/run-action';
import { grpcDataMapper } from '@/features/grpc/mappers';
import { grpcDataService } from '@/features/grpc/services';
import {
  ActionResult,
  GrpcCreateOne,
  GrpcSingleEntityAction,
  GrpcUpdateOne,
} from '@/features/grpc/types';
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
): Promise<ActionResult<GetOneResponse<Entity>>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();

    const entity = await grpcDataService
      .getRepository<Entity>(request.resource)
      .getById({ id: request.id.toString() }, metadata);

    return { data: entity };
  });
}

export async function getList<Entity extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<ActionResult<GetListResponse<Entity>>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();

    const result = await grpcDataService
      .getRepository<Entity>(params.resource)
      .getList(grpcDataMapper.convertGetListParams(params), metadata);

    return { data: result.items, total: result.total };
  });
}

export async function createOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcCreateOne<Entity>,
): Promise<ActionResult<CreateResponse<Entity>>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();

    const entity = await grpcDataService
      .getRepository<Entity>(request.resource)
      .createOne(request.create, metadata);

    return { data: entity };
  });
}

export async function updateOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcUpdateOne<Entity>,
): Promise<ActionResult<UpdateResponse<Entity>>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();

    const entity = await grpcDataService
      .getRepository<Entity>(request.resource)
      .updateById({ id: request.id.toString(), update: request.update }, metadata);

    return { data: entity };
  });
}

export async function deleteOne<Entity extends BaseRecord = BaseRecord>(
  request: GrpcSingleEntityAction,
): Promise<ActionResult<DeleteOneResponse<Entity>>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();

    const entity = await grpcDataService
      .getRepository<Entity>(request.resource)
      .deleteById({ id: request.id.toString() }, metadata);

    return { data: entity };
  });
}
