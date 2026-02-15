import { Type } from '@nestjs/common';
import { OperatorFunction } from 'rxjs';

export type GrpcProxyMethodParams<T = any> =
  | {
      dto?: Type<T>;
      decorators?: MethodDecorator[];
    }
  | Type<T>;

export type GrpcProxyStreamMethodParams = {
  decorators?: MethodDecorator[];
  allowedRoles?: string[];
};

export interface GrpcProxyControllerFactoryParams {
  GrpcController: () => ClassDecorator;
  GrpcMethod: (params?: GrpcProxyMethodParams) => MethodDecorator;
  GrpcStreamMethod: (params?: GrpcProxyStreamMethodParams) => MethodDecorator;
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
