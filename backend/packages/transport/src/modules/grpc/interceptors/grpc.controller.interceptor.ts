import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { transformGrpcData } from 'modules/grpc/helpers';
import { map, Observable } from 'rxjs';

@Injectable()
export class GrpcControllerInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(transformGrpcData));
  }
}
