import {
  GrpcAuthPublicTransport,
  GrpcAuthTransport,
  GrpcFileAdminTransport,
  GrpcFileTransport,
  GrpcFileWebTransport,
  GrpcImageAdminTransport,
  GrpcImageTransport,
  GrpcImageWebTransport,
  GrpcStorageObjectAdminTransport,
  GrpcStorageObjectTransport,
  GrpcStorageObjectWebTransport,
  GrpcTempCodeAdminTransport,
  GrpcTempCodeTransport,
  GrpcTempCodeWebTransport,
  GrpcUserAdminTransport,
  GrpcUserTransport,
  GrpcUserWebTransport,
  GrpcVideoAdminTransport,
  GrpcVideoTransport,
  GrpcVideoWebTransport,
} from '@backend/proto';
import { Transport } from '@nestjs/microservices';
import { GrpcOptions } from '@nestjs/microservices/interfaces/microservice-configuration.interface';
import { validateEnv } from '@packages/common';
// import { wrappers } from 'protobufjs';
import zod from 'zod';
import { PROTO_PATH } from '../constants';

// const declareProtobufWrappers = () => {
//   wrappers['.google.protobuf.Timestamp'] = {
//     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//     // @ts-expect-error
//     fromObject(value: Date) {
//       return {
//         seconds: value.getTime() / 1000,
//         nanos: (value.getTime() % 1000) * 1e6,
//       };
//     },
//     toObject(message: any) {
//       return new Date(message.seconds * 1000 + message.nanos / 1e6);
//     },
//   };
// };

// declareProtobufWrappers();

const env = validateEnv({
  API_GATEWAY_GRPC_URL: zod.string().default('0.0.0.0:8000'),

  AUTH_GRPC_URL: zod.string().default('0.0.0.0:8001'),
  STORAGE_GRPC_URL: zod.string().default('0.0.0.0:8002'),
});

export const grpcConfig = () => {
  const commonGrpcOptions: Partial<GrpcOptions['options']> = {
    loader: {
      arrays: true,
      keepCase: true,
      defaults: true,
      objects: true,
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
        [GrpcAuthPublicTransport.service]: GrpcAuthPublicTransport.definition,
        [GrpcTempCodeAdminTransport.service]: GrpcTempCodeAdminTransport.definition,
        [GrpcTempCodeWebTransport.service]: GrpcTempCodeWebTransport.definition,
        [GrpcUserAdminTransport.service]: GrpcUserAdminTransport.definition,
        [GrpcUserWebTransport.service]: GrpcUserWebTransport.definition,

        [GrpcFileAdminTransport.service]: GrpcFileAdminTransport.definition,
        [GrpcFileWebTransport.service]: GrpcFileWebTransport.definition,
        [GrpcImageAdminTransport.service]: GrpcImageAdminTransport.definition,
        [GrpcImageWebTransport.service]: GrpcImageWebTransport.definition,
        [GrpcStorageObjectAdminTransport.service]: GrpcStorageObjectAdminTransport.definition,
        [GrpcStorageObjectWebTransport.service]: GrpcStorageObjectWebTransport.definition,
        [GrpcVideoAdminTransport.service]: GrpcVideoAdminTransport.definition,
        [GrpcVideoWebTransport.service]: GrpcVideoWebTransport.definition,
      },
    },
    auth: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.AUTH_GRPC_URL,
      },
      services: {
        [GrpcAuthTransport.service]: GrpcAuthTransport.definition,
        [GrpcTempCodeTransport.service]: GrpcTempCodeTransport.definition,
        [GrpcUserTransport.service]: GrpcUserTransport.definition,
      },
    },
    storage: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.STORAGE_GRPC_URL,
      },
      services: {
        [GrpcFileTransport.service]: GrpcFileTransport.definition,
        [GrpcImageTransport.service]: GrpcImageTransport.definition,
        [GrpcStorageObjectTransport.service]: GrpcStorageObjectTransport.definition,
        [GrpcVideoTransport.service]: GrpcVideoTransport.definition,
      },
    },
  } as const;
};

export type GrpcConfig = ReturnType<typeof grpcConfig>;

export type GrpcConfigHost = keyof GrpcConfig;

export type GrpcConfigService<Host extends GrpcConfigHost> = keyof GrpcConfig[Host]['services'];
