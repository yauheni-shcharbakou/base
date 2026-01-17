import { NodeValidationSchema, validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  ...NodeValidationSchema,
  BACKEND_GRPC_URL: zod.string().default('0.0.0.0:8000'),
});

export const config = {
  isDevelopment: env.NODE_ENV === 'development',
  backend: {
    grpcUrl: env.BACKEND_GRPC_URL,
  },
};
