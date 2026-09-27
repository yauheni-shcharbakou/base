import { errorResponse } from '@/features/grpc/helpers/error-response';
import { Metadata, status as GrpcStatus, type ServiceError } from '@grpc/grpc-js';

const serviceError = (code: GrpcStatus, details: string): ServiceError =>
  Object.assign(new Error(`${code} ${GrpcStatus[code]}: ${details}`), {
    code,
    details,
    metadata: new Metadata(),
  });

describe('errorResponse', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('answers a backend 4xx with its status and message, and logs nothing', async () => {
    const response = errorResponse(serviceError(GrpcStatus.NOT_FOUND, 'File not found'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'File not found' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('withholds the address of a transport failure, and logs the error', async () => {
    const error = serviceError(
      GrpcStatus.UNAVAILABLE,
      'No connection established. Last error: connect ECONNREFUSED 10.0.0.5:8000',
    );

    const response = errorResponse(error);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ message: 'The service is unavailable, try again later' });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('answers an error with no gRPC status as a 500', async () => {
    const response = errorResponse(new Error('Forbidden'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: 'Internal server error' });
  });
});
