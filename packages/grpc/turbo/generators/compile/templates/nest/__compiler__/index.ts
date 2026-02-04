import { Type } from '@nestjs/common';
import { join } from 'path';
import { OperatorFunction } from 'rxjs';

export const PROTO_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'node_modules',
  '@packages',
  'grpc',
  'proto',
);

export type GrpcProxyMethodParams<T = any> =
  | {
      dto?: Type<T>;
      decorators?: MethodDecorator[];
    }
  | Type<T>;

export interface GrpcProxyControllerFactoryParams {
  GrpcController: () => ClassDecorator;
  GrpcMethod: (params?: GrpcProxyMethodParams) => MethodDecorator;
  InjectGrpcService: (serviceName: string) => PropertyDecorator & ParameterDecorator;
  proxyPipes: OperatorFunction<any, any>[];
}

export interface GrpcProxyControllerFactoryResult {
  Controller: Type;
  service: string;
}

export type GrpcProxyControllerFactory = (
  params: GrpcProxyControllerFactoryParams,
) => GrpcProxyControllerFactoryResult;
