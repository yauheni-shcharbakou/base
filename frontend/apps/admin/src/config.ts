import { NodeValidationSchema, validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  ...NodeValidationSchema,
  BACKEND_GRPC_URL: zod.string().default('0.0.0.0:8000'),
  NEXT_PUBLIC_DEFAULT_EMAIL: zod.email().default('admin@gmail.com'),
  NEXT_PUBLIC_DEFAULT_PASSWORD: zod.string().default('string123'),
});

const isDevelopment = env.NODE_ENV === 'development';

export const config = {
  isDevelopment,
  backend: {
    grpcUrl: env.BACKEND_GRPC_URL,
  },
  defaultAuth: isDevelopment
    ? {
        email: env.NEXT_PUBLIC_DEFAULT_EMAIL,
        password: env.NEXT_PUBLIC_DEFAULT_PASSWORD,
      }
    : undefined,
};
