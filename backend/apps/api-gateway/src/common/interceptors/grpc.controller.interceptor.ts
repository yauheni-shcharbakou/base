import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class GrpcControllerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GrpcControllerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const startTimestamp = new Date().valueOf();
    const Controller = context.getClass();
    const method = context.getHandler();

    return next.handle().pipe(
      tap((_) => {
        this.logger.debug(
          `${Controller.name}.${method.name} => ${new Date().valueOf() - startTimestamp}ms`,
        );
      }),
    );
  }
}
