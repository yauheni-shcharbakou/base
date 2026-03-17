import { NatsJetStreamContext } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';

export class NatsControllerInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const logger = new Logger(`${context.getClass().name}.${context.getHandler().name}`);
    const ctx = context.switchToRpc().getContext<NatsJetStreamContext>();

    return next.handle().pipe(
      tap(() => {
        ctx.message.ack();
      }),
      catchError((err) => {
        logger.error(err, err.stack);
        ctx.message.nak();
        return throwError(() => err);
      }),
    );
  }
}
