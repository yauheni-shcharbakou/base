import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GrpcRxPipe } from 'modules/grpc/pipes/grpc.rx.pipe';
import { Observable } from 'rxjs';

@Injectable()
export class GrpcControllerInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(GrpcRxPipe.out);
  }
}
