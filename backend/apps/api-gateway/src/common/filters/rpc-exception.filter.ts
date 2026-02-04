import { GrpcStatusCodeMapper } from '@backend/transport';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response, Request } from 'express';
import _ from 'lodash';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const err = exception.getError();
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse();
    const request: Request = ctx.getRequest();
    const statusCode = GrpcStatusCodeMapper.fromGrpcToHttp(err['code']);

    response.status(statusCode).json({
      statusCode,
      message: _.isString(err) ? err : err['details'],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
