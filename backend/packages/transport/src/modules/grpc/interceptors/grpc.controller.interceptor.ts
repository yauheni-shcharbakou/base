import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GrpcDataMapper } from 'modules/grpc/mappers';
import { Observable } from 'rxjs';

@Injectable()
export class GrpcControllerInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(GrpcDataMapper.outTrafficPipe());
  }
}
