import { resolveErrorMessage } from '@backend/common';
import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { catchError, Observable, throwError } from 'rxjs';
import { REDIS_ERROR_FALLBACK } from '@/infrastructure';

/**
 * Logs a failing handler and rethrows. Unlike the NATS interceptor there is no manual
 * ack/nak: the rethrown error rejects the BullMQ processor, which marks the job failed
 * and schedules the retry.
 *
 * The error is re-wrapped in an `RpcException` so it survives `RpcExceptionsHandler`,
 * which would otherwise replace an unknown error with a bare "Internal server error" —
 * and that string is what would end up in the job's `failedReason`.
 *
 * Re-wrapping is also where the original error object is lost — `RpcExceptionsHandler`
 * rejects with a plain `{ status, message }` — so the message has to be resolved here,
 * while the `cause` chain still exists, and not later in the server strategy.
 */
export class RedisControllerInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const logger = new Logger(`${context.getClass().name}.${context.getHandler().name}`);

    return next.handle().pipe(
      catchError((err) => {
        logger.error(err, err.stack);

        if (err instanceof RpcException) {
          return throwError(() => err);
        }

        return throwError(() => new RpcException(resolveErrorMessage(err, REDIS_ERROR_FALLBACK)));
      }),
    );
  }
}
