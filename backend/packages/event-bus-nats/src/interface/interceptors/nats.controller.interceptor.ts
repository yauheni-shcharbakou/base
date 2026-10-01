import { resolveErrorMessage } from '@backend/common';
import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { NATS_ERROR_FALLBACK } from '@/infrastructure';
import { NatsMessageContext } from '../contexts';

/**
 * Manual ack/nak. Unlike the Redis interceptor — where a rejected BullMQ processor schedules
 * the retry on its own — JetStream redelivers only what is left unacked, so every message has
 * to be answered here.
 *
 * There is no `RpcException` re-wrapping either: nothing persists the message the way BullMQ
 * writes `failedReason` into the DLQ, so the original error goes straight to the logger with
 * its stack. That makes the log line the only record a failure leaves behind, which is why
 * the message is resolved through the `cause` chain — a MikroORM `DriverException` or an
 * ioredis-style `AggregateError` carries none of its own.
 */
export class NatsControllerInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const logger = new Logger(`${context.getClass().name}.${context.getHandler().name}`);
    const ctx = context.switchToRpc().getContext<NatsMessageContext>();

    return next.handle().pipe(
      tap(() => {
        ctx.ack();
      }),
      catchError((err) => {
        logger.error(resolveErrorMessage(err, NATS_ERROR_FALLBACK), err?.stack);
        ctx.nak();
        return throwError(() => err);
      }),
    );
  }
}
