import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERSISTENCE_SERVICE, PersistenceService } from 'common';
import { from, lastValueFrom, Observable } from 'rxjs';

@Injectable()
export class PostgresRequestInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // TODO: move to @packages/common as a decorator
    const shouldSkip: boolean = this.reflector.getAllAndOverride('grpc-stream', [
      context.getHandler(),
      context.getClass,
    ]);

    if (shouldSkip) {
      return next.handle();
    }

    return from(
      this.persistenceService.isolatedRun(async () => {
        return lastValueFrom(next.handle());
      }),
    );
  }
}
