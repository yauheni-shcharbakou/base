import { DatabaseRunnerService } from '@backend/common';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { from, isObservable, lastValueFrom, Observable } from 'rxjs';

@Injectable()
export class PgRequestInterceptor implements NestInterceptor {
  constructor(
    @Inject(DatabaseRunnerService) private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'rpc' || isObservable(context.switchToRpc().getData())) {
      return next.handle();
    }

    return from(
      this.databaseRunnerService.isolatedRun(async () => {
        return lastValueFrom(next.handle());
      }),
    );
  }
}
