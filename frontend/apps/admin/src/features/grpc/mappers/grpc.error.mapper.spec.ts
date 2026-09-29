import { createServiceError as serviceError } from '@/features/grpc/helpers/service-error';
import { status } from '@grpc/grpc-js';
import { GrpcErrorMapper } from './grpc.error.mapper';

const mapper = new GrpcErrorMapper();

describe('GrpcErrorMapper.toActionError', () => {
  it("keeps the callee's message for a client error", () => {
    const error = serviceError(status.INVALID_ARGUMENT, "You can't delete the root folder");

    expect(mapper.toActionError(error)).toEqual({
      message: "You can't delete the root folder",
      statusCode: 400,
    });
  });

  it.each([
    [status.UNAUTHENTICATED, 401],
    [status.PERMISSION_DENIED, 403],
    [status.NOT_FOUND, 404],
    [status.ALREADY_EXISTS, 409],
    [status.FAILED_PRECONDITION, 400],
    [status.RESOURCE_EXHAUSTED, 429],
  ])('maps gRPC status %i to HTTP %i', (code, statusCode) => {
    expect(mapper.toActionError(serviceError(code, 'Reason'))).toEqual({
      message: 'Reason',
      statusCode,
    });
  });

  it('withholds the details of a server failure, which may name an internal host', () => {
    const error = serviceError(
      status.UNAVAILABLE,
      'No connection established. Last error: Error: connect ECONNREFUSED 10.0.0.5:8000',
    );

    expect(mapper.toActionError(error)).toEqual({
      message: 'The service is unavailable, try again later',
      statusCode: 503,
    });
  });

  it.each([
    [status.UNKNOWN, 500],
    [status.INTERNAL, 500],
    [status.DATA_LOSS, 500],
    [status.UNIMPLEMENTED, 501],
    [status.DEADLINE_EXCEEDED, 504],
  ])('gives gRPC status %i a fixed message and HTTP %i', (code, statusCode) => {
    const { message, statusCode: actual } = mapper.toActionError(
      serviceError(code, 'relation "storage_object" does not exist'),
    );

    expect(actual).toBe(statusCode);
    expect(message).not.toContain('storage_object');
  });

  it('treats an error without a gRPC status as an internal one', () => {
    expect(mapper.toActionError(new Error('connect ECONNREFUSED 10.0.0.5:8000'))).toEqual({
      message: 'Internal server error',
      statusCode: 500,
    });

    expect(mapper.toActionError('Forbidden')).toEqual({
      message: 'Internal server error',
      statusCode: 500,
    });
  });

  it('falls back to a generic message when a client error has none', () => {
    expect(mapper.toActionError(serviceError(status.NOT_FOUND, ''))).toEqual({
      message: 'The request failed',
      statusCode: 404,
    });
  });

  it('does not take a status OK rejection for a success', () => {
    expect(mapper.toActionError(serviceError(status.OK, 'Reason')).statusCode).toBe(500);
  });
});
