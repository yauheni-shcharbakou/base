import 'reflect-metadata';
import { Metadata, status } from '@grpc/grpc-js';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { RpcException } from '@nestjs/microservices';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { of } from 'rxjs';
import {
  DEFAULT_THROTTLE,
  GRPC_THROTTLER_OPTIONS,
  PUBLIC_THROTTLE,
} from '../constants/grpc.throttle.constants';
import {
  DefaultGrpcController,
  PublicGrpcController,
} from '../decorators/grpc.controller.decorator';
import { GrpcAccessUnaryGuard } from './grpc.access-unary.guard';
import { GrpcThrottlerGuard } from './grpc.throttler.guard';

@DefaultGrpcController()
class UserController {
  getOne() {}
  getList() {}
}

@PublicGrpcController()
class AuthController {
  login() {}
  refreshToken() {}
}

type Controller = typeof UserController | typeof AuthController;

const metadataOf = (entries: Record<string, string>): Metadata => {
  const metadata = new Metadata();
  Object.entries(entries).forEach(([key, value]) => metadata.set(key, value));
  return metadata;
};

const context = (
  controller: Controller,
  method: string,
  entries: Record<string, string> = {},
  { peer = '10.0.0.1:50000', data = {} as unknown } = {},
) => {
  const host = new ExecutionContextHost(
    [data, metadataOf(entries), { getPeer: () => peer }],
    controller,
    controller.prototype[method],
  );

  host.setType('rpc');
  return host;
};

describe('GrpcThrottlerGuard', () => {
  let storage: ThrottlerStorageService;
  let guard: GrpcThrottlerGuard;

  const pass = async (contexts: ExecutionContextHost[]) => {
    for (const ctx of contexts) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  };

  const rejection = (ctx: ExecutionContextHost) =>
    guard.canActivate(ctx).then(
      () => undefined,
      (error: RpcException) => error.getError(),
    );

  const times = <T>(count: number, make: (index: number) => T): T[] =>
    Array.from({ length: count }, (_, index) => make(index));

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new GrpcThrottlerGuard(GRPC_THROTTLER_OPTIONS, storage, new Reflector());
    await guard.onModuleInit();
  });

  afterEach(() => storage.onApplicationShutdown());

  // It counts by the `user-id` the access guard puts into the metadata, so it has to run second.
  it('runs after the access guard on every gRPC controller', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UserController)).toEqual([
      GrpcAccessUnaryGuard,
      GrpcThrottlerGuard,
    ]);
  });

  it('counts an authenticated caller by user id, across handlers', async () => {
    const method = (index: number) => (index % 2 ? 'getOne' : 'getList');

    await pass(
      times(DEFAULT_THROTTLE.limit, (index) =>
        context(UserController, method(index), { 'user-id': 'u1' }, { peer: `10.0.0.1:${index}` }),
      ),
    );

    expect(await rejection(context(UserController, 'getOne', { 'user-id': 'u1' }))).toEqual({
      code: status.RESOURCE_EXHAUSTED,
      details: 'Too many requests',
    });

    // Every admin reaches the gateway through the same Next server, so one peer.
    await pass([context(UserController, 'getOne', { 'user-id': 'u2' })]);
  });

  it('counts a public caller by the forwarded client address, with the stricter limit', async () => {
    const method = (index: number) => (index % 2 ? 'login' : 'refreshToken');

    await pass(
      times(PUBLIC_THROTTLE.limit, (index) =>
        context(AuthController, method(index), { 'x-client-ip': '203.0.113.7' }),
      ),
    );

    expect(
      await rejection(context(AuthController, 'login', { 'x-client-ip': '203.0.113.7' })),
    ).toMatchObject({ code: status.RESOURCE_EXHAUSTED });

    await pass([context(AuthController, 'login', { 'x-client-ip': '203.0.113.8' })]);
  });

  it('ignores a user id a public caller sends itself', async () => {
    await pass(
      times(PUBLIC_THROTTLE.limit, (index) =>
        context(AuthController, 'login', { 'x-client-ip': '203.0.113.7', 'user-id': `u${index}` }),
      ),
    );

    expect(
      await rejection(
        context(AuthController, 'login', { 'x-client-ip': '203.0.113.7', 'user-id': 'fresh' }),
      ),
    ).toMatchObject({ code: status.RESOURCE_EXHAUSTED });
  });

  it('falls back to the peer host, whatever its port, without a forwarded address', async () => {
    await pass(
      times(PUBLIC_THROTTLE.limit, (index) =>
        context(AuthController, 'login', {}, { peer: `::ffff:172.18.0.5:${40000 + index}` }),
      ),
    );

    expect(
      await rejection(context(AuthController, 'login', {}, { peer: '::ffff:172.18.0.5:49999' })),
    ).toMatchObject({ code: status.RESOURCE_EXHAUSTED });

    await pass([context(AuthController, 'login', {}, { peer: '::ffff:172.18.0.6:40000' })]);
  });

  it('does not count stream calls', async () => {
    await pass(
      times(DEFAULT_THROTTLE.limit * 2, () =>
        context(UserController, 'getOne', { 'user-id': 'u1' }, { data: of({}) }),
      ),
    );
  });
});
