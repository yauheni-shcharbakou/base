import { DATABASE_RUNNER_SERVICE, type DatabaseRunnerService } from '@backend/common';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { from, isObservable, lastValueFrom, Observable } from 'rxjs';

@Injectable()
export class PostgresRequestInterceptor implements NestInterceptor {
  constructor(
    @Inject(DATABASE_RUNNER_SERVICE) private readonly persistenceService: DatabaseRunnerService,
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
