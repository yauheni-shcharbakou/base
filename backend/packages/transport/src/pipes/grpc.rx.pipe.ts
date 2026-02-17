import { Either } from '@sweet-monads/either';
import { GrpcExceptionMapper } from 'mappers';
import { catchError, map, Observable, OperatorFunction, pipe, throwError } from 'rxjs';

export class GrpcRxPipe {
  /**
   * @description rxjs pipe for catch error and throw rpc exception
   * @example
   * const result = grpcClient.getUsers().pipe(GrpcRxPipe.in, ...other pipes, GrpcRxPipe.rpcException)
   */
  static get rpcException(): <T>(source: Observable<T>) => Observable<T> {
    return <T>(source: Observable<T>) => {
      return source.pipe(
        catchError((exception) => throwError(() => GrpcExceptionMapper.toRpcException(exception))),
      );
    };
  }

  /**
   * @description rxjs pipe for incoming grpc proxy requests (api-gateway requests, GrpcRxPipe.rpcException pipe included)
   * @param mapper optional mapper for grpc data (will execute before GrpcRxPipe.rpcException)
   * @example
   * const result = grpcClient.getUsers().pipe(GrpcRxPipe.proxy((res) => res.id))
   */
  static proxy<In, Out = In>(mapper?: (data: In) => Out): OperatorFunction<In, Out> {
    if (!mapper) {
      return pipe(GrpcRxPipe.rpcException) as unknown as OperatorFunction<In, Out>;
    }

    return pipe(map(mapper), GrpcRxPipe.rpcException);
  }

  static get unwrapEither() {
    return <L, R>(source: Observable<Either<L, R>>): Observable<R> => {
      return source.pipe(
        map((data) => {
          if (data.isLeft()) {
            throw GrpcExceptionMapper.toRpcException(data.value);
          }

          return data.value;
        }),
        catchError((exception) => throwError(() => GrpcExceptionMapper.toRpcException(exception))),
      );
    };
  }
}
