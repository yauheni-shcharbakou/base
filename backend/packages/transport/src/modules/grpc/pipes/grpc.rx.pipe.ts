import { RpcException } from '@nestjs/microservices';
import { GrpcDataMapper } from 'modules/grpc/mappers';
import { catchError, map, OperatorFunction, pipe, throwError } from 'rxjs';

export class GrpcRxPipe {
  /**
   * @description rxjs pipe for incoming grpc requests
   * @example
   * const result = grpcClient.getUsers().pipe(GrpcRxPipe.in, ...other pipes)
   */
  static get in() {
    return pipe(map(GrpcDataMapper.inTraffic));
  }

  /**
   * @description rxjs pipe for outcoming grpc requests
   * @example
   * intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
   *     return next.handle().pipe(GrpcRxPipe.out);
   * }
   */
  static get out() {
    return pipe(map(GrpcDataMapper.outTraffic));
  }

  /**
   * @description rxjs pipe for catch error and throw rpc exception
   * @example
   * const result = grpcClient.getUsers().pipe(GrpcRxPipe.in, ...other pipes, GrpcRxPipe.rpcException)
   */
  static get rpcException() {
    return pipe(catchError((exception) => throwError(() => new RpcException(exception))));
  }

  /**
   * @description rxjs pipe for incoming grpc proxy requests (api-gateway requests, GrpcRxPipe.in and rpc exception pipe included)
   * @param mapper optional mapper for grpc data (will execute after GrpcRxPipe.in)
   * @example
   * const result = grpcClient.getUsers().pipe(GrpcRxPipe.proxy((res) => res.id))
   */
  static proxy<In, Out = In>(mapper?: (data: In) => Out): OperatorFunction<In, Out> {
    if (!mapper) {
      return pipe(GrpcRxPipe.in, GrpcRxPipe.rpcException) as OperatorFunction<In, Out>;
    }

    return pipe(GrpcRxPipe.in, map(mapper), GrpcRxPipe.rpcException) as OperatorFunction<In, Out>;
  }
}
