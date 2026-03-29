import { constantCase } from 'change-case-all';

export const getGrpcClientToken = (client: string): string => {
  return `${constantCase(client)}_GRPC_CLIENT`;
};

export const getGrpcServiceToken = (service: string): string => {
  return `${constantCase(service)}_GRPC_SERVICE`;
};
