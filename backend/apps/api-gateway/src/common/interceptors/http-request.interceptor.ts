import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class HttpRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpRequestInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startTimestamp = new Date().valueOf();
    const request: Request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((_) => {
        this.logger.debug(
          `${request.method} ${request.path} => ${new Date().valueOf() - startTimestamp}ms`,
        );
      }),
    );
  }
}
