import { ClientCommon } from '@frontend/proto';
import type { CallOptions, Metadata } from '@grpc/grpc-js';
import { BaseRecord } from '@refinedev/core';

export type GrpcUpdateById<Entity extends BaseRecord = BaseRecord> = ClientCommon.IdField & {
  update: {
    set?: Partial<Entity>;
    delete?: string[];
    inc?: Partial<Entity>;
  };
};

export interface GrpcDataRepository<Entity extends BaseRecord = BaseRecord> {
  getById(
    request: ClientCommon.IdField,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  getList(
    request: ClientCommon.GetListRequest,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<{ items: Entity[]; total: number }>;
  createOne(
    request: Partial<Entity>,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  updateById(
    request: GrpcUpdateById<Entity>,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  deleteById(
    request: ClientCommon.IdField,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
}

export interface GrpcSingleEntityAction extends ClientCommon.IdField {
  resource: string;
}

export interface GrpcCreateOne<Entity extends BaseRecord = BaseRecord> {
  resource: string;
  create: Partial<Entity>;
}

export interface GrpcUpdateOne<
  Entity extends BaseRecord = BaseRecord,
> extends GrpcUpdateById<Entity> {
  resource: string;
}
