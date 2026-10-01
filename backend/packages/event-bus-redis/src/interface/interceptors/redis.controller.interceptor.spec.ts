import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RedisControllerInterceptor } from './redis.controller.interceptor';

const buildContext = (type: 'rpc' | 'http' = 'rpc'): ExecutionContext =>
  ({
    getType: () => type,
    getClass: () => ({ name: 'RedisUserController' }),
    getHandler: () => ({ name: 'onCreate' }),
  }) as unknown as ExecutionContext;

const buildHandler = (error?: unknown): CallHandler => ({
  handle: () => (error ? throwError(() => error) : of('handled')),
});

const intercept = (context: ExecutionContext, handler: CallHandler): Promise<unknown> => {
  const result = new RedisControllerInterceptor().intercept(context, handler);
  return lastValueFrom(result as ReturnType<CallHandler['handle']>);
};

describe('RedisControllerInterceptor', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('passes a non-rpc context straight through', async () => {
    await expect(intercept(buildContext('http'), buildHandler())).resolves.toBe('handled');
  });

  it('lets a successful handler through untouched', async () => {
    await expect(intercept(buildContext(), buildHandler())).resolves.toBe('handled');
  });

  it('rethrows an existing RpcException as it is', async () => {
    const error = new RpcException('already wrapped');

    await expect(intercept(buildContext(), buildHandler(error))).rejects.toBe(error);
  });

  // Without the wrapping, `RpcExceptionsHandler` replaces an unknown error with a bare
  // "Internal server error" — and that string is what BullMQ would store in `failedReason`.
  it('wraps an unknown error into an RpcException', async () => {
    const error = await intercept(buildContext(), buildHandler(new Error('handler blew up'))).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).message).toBe('handler blew up');
  });

  // This is the only point where the original error object still exists, so the message has to
  // be recovered here — a MikroORM `DriverException` over the `AggregateError` Node raises for a
  // refused connection carries none of its own.
  it('recovers the message of a wrapper error before it is lost', async () => {
    const cause = new AggregateError([new Error('connect ECONNREFUSED ::1:5432')], '');
    const wrapper = Object.assign(new Error(''), { cause, name: 'DriverException' });

    const error = await intercept(buildContext(), buildHandler(wrapper)).catch(
      (err: unknown) => err,
    );

    expect((error as RpcException).message).toBe('connect ECONNREFUSED ::1:5432');
  });

  // The class of a message-less error still says more than an empty string.
  it('falls back to the error class before the fixed message', async () => {
    class DriverException extends Error {}

    const error = await intercept(buildContext(), buildHandler(new DriverException(''))).catch(
      (err: unknown) => err,
    );

    expect((error as RpcException).message).toBe('DriverException');
  });

  it('falls back to a fixed message when even the class says nothing', async () => {
    const error = await intercept(buildContext(), buildHandler({ status: 'error' })).catch(
      (err: unknown) => err,
    );

    expect((error as RpcException).message).toBe('Redis event handler failed');
  });
});
