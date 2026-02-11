import { Transport } from '@nestjs/microservices';
import { GrpcOptions } from '@nestjs/microservices/interfaces/microservice-configuration.interface';
import { validateEnv } from '@packages/common';
import {
  GrpcAuthService,
  GrpcContactService,
  GrpcFileService,
  GrpcUserService,
  PROTO_PATH,
} from '@backend/grpc';
import { wrappers } from 'protobufjs';
import zod from 'zod';

const declareProtobufWrappers = () => {
  wrappers['.google.protobuf.Timestamp'] = {
    // @ts-ignore
    fromObject(value: Date) {
      return {
        seconds: value.getTime() / 1000,
        nanos: (value.getTime() % 1000) * 1e6,
      };
    },
    toObject(message: any) {
      return new Date(message.seconds * 1000 + message.nanos / 1e6);
    },
  };
};

declareProtobufWrappers();

const env = validateEnv({
  API_GATEWAY_GRPC_URL: zod.string().default('0.0.0.0:8000'),

  AUTH_GRPC_URL: zod.string().default('0.0.0.0:8001'),
  FILE_GRPC_URL: zod.string().default('0.0.0.0:8002'),
});

export const grpcConfig = () => {
  const commonGrpcOptions: Partial<GrpcOptions['options']> = {
    loader: {
      arrays: true,
      keepCase: true,
      defaults: true,
      enums: String,
      includeDirs: [PROTO_PATH],
    },
  };

  return {
    apiGateway: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.API_GATEWAY_GRPC_URL,
      },
      services: {
        [GrpcAuthService.name]: GrpcAuthService.definition,
        [GrpcUserService.name]: GrpcUserService.definition,

        [GrpcFileService.name]: GrpcFileService.definition,
      },
    },
    auth: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.AUTH_GRPC_URL,
      },
      services: {
        [GrpcAuthService.name]: GrpcAuthService.definition,
        [GrpcUserService.name]: GrpcUserService.definition,
      },
    },
    file: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.FILE_GRPC_URL,
      },
      services: {
        [GrpcFileService.name]: GrpcFileService.definition,
      },
    },
  } as const;
};

export type GrpcConfig = ReturnType<typeof grpcConfig>;

export type GrpcHost = keyof GrpcConfig;
