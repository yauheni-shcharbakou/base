import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class PostgresRequestInterceptor implements NestInterceptor {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return new Observable((observer) => {
      RequestContext.create(this.orm.em, () => {
        const subscription = next.handle().subscribe({
          next: (val) => observer.next(val),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });

        return () => subscription.unsubscribe();
      });
    });
  }
}
