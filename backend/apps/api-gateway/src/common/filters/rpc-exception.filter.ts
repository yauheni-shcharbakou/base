import { GrpcExceptionMapper } from '@backend/transport';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response, Request } from 'express';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse();
    const request: Request = ctx.getRequest();

    const httpException = GrpcExceptionMapper.toHttpException(exception);
    const statusCode = httpException.getStatus();

    response.status(statusCode).json({
      statusCode,
      message: httpException.getResponse(),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
