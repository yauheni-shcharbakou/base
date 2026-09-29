import { sessionEndedError, toRefreshError } from '@/features/auth/helpers/session-error';
import { createServiceError } from '@/features/grpc/helpers/service-error';
import { grpcErrorMapper } from '@/features/grpc/mappers';
import { status } from '@grpc/grpc-js';

describe('sessionEndedError', () => {
  it('maps to a 401 that keeps its message', () => {
    expect(grpcErrorMapper.toActionError(sessionEndedError('Refresh token is missing'))).toEqual({
      message: 'Refresh token is missing',
      statusCode: 401,
    });
  });
});

describe('toRefreshError', () => {
  it.each([status.UNAUTHENTICATED, status.PERMISSION_DENIED, status.NOT_FOUND])(
    'turns a refresh refused with gRPC status %i into a 401',
    (code) => {
      const error = toRefreshError(createServiceError(code, 'Refresh token invalid'));

      expect(grpcErrorMapper.toActionError(error)).toEqual({
        message: 'Refresh token invalid',
        statusCode: 401,
      });
    },
  );

  it.each([status.UNAVAILABLE, status.RESOURCE_EXHAUSTED, status.INTERNAL])(
    'leaves a refresh that failed with gRPC status %i as it was',
    (code) => {
      const error = createServiceError(code, 'Reason');

      expect(toRefreshError(error)).toBe(error);
    },
  );

  it('leaves an error without a gRPC status as it was', () => {
    const error = new Error('socket hang up');

    expect(toRefreshError(error)).toBe(error);
  });
});
