import { ONE_MB_BYTES } from '@/common/constants';
import { NodeValidationSchema, validateEnv } from '@packages/common';
import zod from 'zod';

export class ConfigService {
  private readonly env = validateEnv({
    ...NodeValidationSchema,
    BACKEND_GRPC_URL: zod.string().default('0.0.0.0:8000'),
    DEFAULT_EMAIL: zod.email().default('admin@gmail.com'),
    DEFAULT_PASSWORD: zod.string().default('string123'),
    CHUNK_SIZE_MB: zod.coerce.number().default(1),
  });

  public readonly isDevelopment = this.env.NODE_ENV === 'development';

  private readonly config = {
    isDevelopment: this.isDevelopment,
    backend: {
      grpcUrl: this.env.BACKEND_GRPC_URL,
    },
    defaultAuth: this.isDevelopment
      ? {
          email: this.env.DEFAULT_EMAIL,
          password: this.env.DEFAULT_PASSWORD,
        }
      : undefined,
  } as const;

  getGrpcUrl() {
    return this.config.backend.grpcUrl;
  }

  getDefaultAuth() {
    return this.config.defaultAuth;
  }

  getChunkSize() {
    return this.env.CHUNK_SIZE_MB * ONE_MB_BYTES;
  }
}
