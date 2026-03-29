import { GrpcGetListRequest, GrpcIdField } from '@frontend/grpc';
import { type CallOptions, Metadata } from '@grpc/grpc-js';
import { BaseRecord } from '@refinedev/core';

export type GrpcUpdateById<Entity extends BaseRecord = BaseRecord> = GrpcIdField & {
  update: {
    set?: Partial<Entity>;
    delete?: string[];
    inc?: Partial<Entity>;
  };
};

export interface GrpcDataRepository<Entity extends BaseRecord = BaseRecord> {
  getById(
    request: GrpcIdField,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  // getMany(
  //   request: { ids: string[] },
  //   metadata?: Metadata,
  //   options?: Partial<CallOptions>,
  // ): Promise<{ items: Entity[] }>;
  getList(
    request: GrpcGetListRequest,
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
    request: GrpcIdField,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
}

export interface GrpcSingleEntityAction extends GrpcIdField {
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
