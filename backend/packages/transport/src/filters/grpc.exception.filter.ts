import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { BaseRpcExceptionFilter } from '@nestjs/microservices';
import { GrpcExceptionMapper } from 'mappers';
import { Observable } from 'rxjs';

@Catch()
export class GrpcExceptionFilter extends BaseRpcExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): Observable<any> {
    return super.catch(GrpcExceptionMapper.toRpcException(exception), host);
  }
}
