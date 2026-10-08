import { describe, expect, it } from 'vitest';
import { Metadata, status as GrpcStatus, type ServiceError } from '@grpc/grpc-js';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { GrpcExceptionMapper } from './grpc.exception.mapper';

// What grpc-js rejects an outbound call with: its message prefixes `details` with the status.
const serviceError = (code: GrpcStatus, details: string): ServiceError =>
  Object.assign(new Error(`${code} ${GrpcStatus[code]}: ${details}`), {
    code,
    details,
    metadata: new Metadata(),
  });

describe('GrpcExceptionMapper.toRpcException', () => {
  it('returns an RpcException as is', () => {
    const exception = new RpcException({ code: GrpcStatus.NOT_FOUND, details: 'missing' });

    expect(GrpcExceptionMapper.toRpcException(exception)).toBe(exception);
  });

  // The gateway forwards a downstream failure: wrapped as UNKNOWN, the callee's status was lost
  // and the client read "3 INVALID_ARGUMENT: ..." as the message.
  it.each([
    [GrpcStatus.INVALID_ARGUMENT, "You can't delete the root folder"],
    [GrpcStatus.NOT_FOUND, 'Storage object not found'],
    [GrpcStatus.PERMISSION_DENIED, 'Refresh token invalid'],
    [GrpcStatus.UNAVAILABLE, 'No connection established'],
  ])('passes a ServiceError with code %i through unchanged', (code, details) => {
    const error = GrpcExceptionMapper.toRpcException(serviceError(code, details)).getError();

    expect(error).toEqual({ code, details });
  });

  it.each([
    [new BadRequestException('Name is taken'), GrpcStatus.INVALID_ARGUMENT, 'Name is taken'],
    [
      new NotFoundException('Storage object not found'),
      GrpcStatus.NOT_FOUND,
      'Storage object not found',
    ],
    [
      new ConflictException('User already exists'),
      GrpcStatus.ALREADY_EXISTS,
      'User already exists',
    ],
    [new ServiceUnavailableException('Down'), GrpcStatus.UNAVAILABLE, 'Down'],
    // `HttpExceptionMapper.getMessage` joins a validation pipe's message list.
    [
      new BadRequestException(['name is empty', 'parent is invalid']),
      GrpcStatus.INVALID_ARGUMENT,
      'name is empty, parent is invalid',
    ],
  ])('maps %s through the status table', (exception, code, details) => {
    expect(GrpcExceptionMapper.toRpcException(exception).getError()).toEqual({ code, details });
  });

  it('maps an HTTP status the table does not list to INTERNAL', () => {
    const error = GrpcExceptionMapper.toRpcException(new HttpException('Teapot', 418)).getError();

    expect(error).toEqual({ code: GrpcStatus.INTERNAL, details: 'Teapot' });
  });

  it('turns any other error into UNKNOWN with its message', () => {
    const error = GrpcExceptionMapper.toRpcException(new Error('Something broke')).getError();

    expect(error).toEqual({ code: GrpcStatus.UNKNOWN, details: 'Something broke' });
  });

  // A status without details is not a ServiceError grpc-js would produce.
  it('does not take an error with a code but no details for a ServiceError', () => {
    const error = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });

    expect(GrpcExceptionMapper.toRpcException(error).getError()).toEqual({
      code: GrpcStatus.UNKNOWN,
      details: 'Connection reset',
    });
  });

  it('falls back to a fixed message for a thrown non-error', () => {
    expect(GrpcExceptionMapper.toRpcException(undefined).getError()).toEqual({
      code: GrpcStatus.UNKNOWN,
      details: 'Unknown exception',
    });
  });
});

describe('GrpcExceptionMapper.toHttpException', () => {
  it('maps the code back to an HTTP status and keeps the details as the message', () => {
    const exception = GrpcExceptionMapper.toHttpException(
      new RpcException({ code: GrpcStatus.NOT_FOUND, details: 'Storage object not found' }),
    );

    expect(exception.getStatus()).toBe(404);
    expect(exception.message).toBe('Storage object not found');
  });
});
