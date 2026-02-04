import { getHttpExceptionResponseMessage } from '@backend/common';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response, Request } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse();
    const request: Request = ctx.getRequest();
    const statusCode = exception.getStatus();

    return response.status(statusCode).json({
      statusCode,
      message: getHttpExceptionResponseMessage(exception),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
