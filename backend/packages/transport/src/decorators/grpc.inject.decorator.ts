import { Inject } from '@nestjs/common';
import { getGrpcClientToken, getGrpcServiceToken } from 'helpers';

export const InjectGrpcClient = (client: string): PropertyDecorator & ParameterDecorator => {
  return Inject(getGrpcClientToken(client));
};

export const InjectGrpcService = (service: string): PropertyDecorator & ParameterDecorator => {
  return Inject(getGrpcServiceToken(service));
};
