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
    request: ClientCommon.GetList,
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

/**
 * What the page may know of a failed server action: the `message` and `statusCode` of Refine's
 * `HttpError`.
 */
export type ActionError = {
  message: string;
  statusCode: number;
};

/**
 * A server action's outcome, failure included. A production build strips the message of an error
 * thrown in a server action — the client gets a generic one and a `digest` — so the actions return
 * their failure (`runAction`) and the client throws it again (`unwrapActionResult`).
 */
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: ActionError };
