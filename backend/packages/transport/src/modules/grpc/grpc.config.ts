import { Transport } from '@nestjs/microservices';
import { GrpcOptions } from '@nestjs/microservices/interfaces/microservice-configuration.interface';
import { validateEnv } from '@packages/common';
import { CONTACT_SERVICE_NAME, MAIN_PACKAGE_NAME, PROTO_PATH } from '@packages/grpc.nest';
import Joi from 'joi';
import { join } from 'path';

const env = validateEnv({
  MAIN_GRPC_URL: Joi.string().optional(),
});

const commonGrpcOptions: Partial<GrpcOptions['options']> = {
  loader: {
    arrays: true,
    keepCase: true,
    enums: String,
  },
};

export const grpcConfig = () =>
  ({
    [MAIN_PACKAGE_NAME]: {
      transport: Transport.GRPC,
      options: <GrpcOptions['options']>{
        ...commonGrpcOptions,
        url: env.MAIN_GRPC_URL ?? '0.0.0.0:8000',
        package: MAIN_PACKAGE_NAME,
        protoPath: join(PROTO_PATH, 'main.proto'),
      },
      services: [CONTACT_SERVICE_NAME],
    },
  }) as const;

export type GrpcConfig = ReturnType<typeof grpcConfig>;

export type GrpcPackage = keyof GrpcConfig;
