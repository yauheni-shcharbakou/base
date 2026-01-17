import { Type } from '@nestjs/common';
import { join } from 'path';
import { OperatorFunction } from 'rxjs';

export const PROTO_PATH = join(__dirname, '../../../../..', 'node_modules/@packages/grpc/proto');

console.log(__dirname, PROTO_PATH);

export interface GrpcProxyControllerFactoryParams<DtoSchema extends object> {
  GrpcController: () => ClassDecorator;
  ValidateGrpcPayload: (Dto: Type) => MethodDecorator;
  InjectGrpcService: (serviceName: string) => PropertyDecorator & ParameterDecorator;
  dtoSchema: DtoSchema;
  proxyPipes: OperatorFunction<any, any>[];
}

export interface GrpcProxyControllerFactoryResult {
  Controller: Type;
  service: string;
}
