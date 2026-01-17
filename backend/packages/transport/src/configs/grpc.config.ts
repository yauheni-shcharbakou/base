import { Transport } from '@nestjs/microservices';
import { GrpcOptions } from '@nestjs/microservices/interfaces/microservice-configuration.interface';
import { validateEnv } from '@packages/common';
import {
  AUTH_PACKAGE_NAME,
  AUTH_SERVICE_NAME,
  CONTACT_PACKAGE_NAME,
  CONTACT_SERVICE_NAME,
  PROTO_PATH,
} from '@packages/grpc.nest';
import { join } from 'path';
import zod from 'zod';

export type GrpcConfigServiceDefinition = {
  package: string;
  protoPath: string;
};

const env = validateEnv({
  API_GATEWAY_GRPC_URL: zod.string().default('0.0.0.0:8000'),

  MAIN_GRPC_URL: zod.string().default('0.0.0.0:8001'),
  AUTH_GRPC_URL: zod.string().default('0.0.0.0:8002'),
});

export const grpcConfig = () => {
  const commonGrpcOptions: Partial<GrpcOptions['options']> = {
    loader: {
      arrays: true,
      keepCase: true,
      enums: String,
      includeDirs: [PROTO_PATH],
    },
  };

  const services = {
    [AUTH_SERVICE_NAME]: {
      name: AUTH_SERVICE_NAME,
      definition: <GrpcConfigServiceDefinition>{
        package: AUTH_PACKAGE_NAME,
        protoPath: join(PROTO_PATH, 'auth.proto'),
      },
    },
    [CONTACT_SERVICE_NAME]: {
      name: CONTACT_SERVICE_NAME,
      definition: <GrpcConfigServiceDefinition>{
        package: CONTACT_PACKAGE_NAME,
        protoPath: join(PROTO_PATH, 'contact.proto'),
      },
    },
  } as const;

  return {
    apiGateway: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.API_GATEWAY_GRPC_URL,
      },
      services: {
        [services[AUTH_SERVICE_NAME].name]: services[AUTH_SERVICE_NAME].definition,
        [services[CONTACT_SERVICE_NAME].name]: services[CONTACT_SERVICE_NAME].definition,
      },
    },
    auth: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.AUTH_GRPC_URL,
      },
      services: {
        [services[AUTH_SERVICE_NAME].name]: services[AUTH_SERVICE_NAME].definition,
      },
    },
    main: {
      transport: Transport.GRPC,
      options: {
        ...commonGrpcOptions,
        url: env.MAIN_GRPC_URL,
      },
      services: {
        [services[CONTACT_SERVICE_NAME].name]: services[CONTACT_SERVICE_NAME].definition,
      },
    },
  } as const;
};

export type GrpcConfig = ReturnType<typeof grpcConfig>;

export type GrpcHost = keyof GrpcConfig;
