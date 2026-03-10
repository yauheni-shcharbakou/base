import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { PERSISTENCE_SERVICE, type PersistenceService } from 'common';
import { from, isObservable, lastValueFrom, Observable } from 'rxjs';

@Injectable()
export class PostgresRequestInterceptor implements NestInterceptor {
  constructor(
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'rpc' || isObservable(context.switchToRpc().getData())) {
      return next.handle();
    }

    return from(
      this.persistenceService.isolatedRun(async () => {
        return lastValueFrom(next.handle());
      }),
    );
  }
}
