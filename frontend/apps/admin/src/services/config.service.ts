import { NodeValidationSchema, validateEnv } from '@packages/common';
import zod from 'zod';

export class ConfigService {
  private readonly env = validateEnv({
    ...NodeValidationSchema,
    BACKEND_GRPC_URL: zod.string().default('0.0.0.0:8000'),
    NEXT_PUBLIC_DEFAULT_EMAIL: zod.email().default('admin@gmail.com'),
    NEXT_PUBLIC_DEFAULT_PASSWORD: zod.string().default('string123'),
  });

  public readonly isDevelopment = this.env.NODE_ENV === 'development';

  private readonly config = {
    isDevelopment: this.isDevelopment,
    backend: {
      grpcUrl: this.env.BACKEND_GRPC_URL,
    },
    defaultAuth: this.isDevelopment
      ? {
          email: this.env.NEXT_PUBLIC_DEFAULT_EMAIL,
          password: this.env.NEXT_PUBLIC_DEFAULT_PASSWORD,
        }
      : undefined,
  } as const;

  getGrpcUrl() {
    return this.config.backend.grpcUrl;
  }

  getDefaultAuth() {
    return this.config.defaultAuth;
  }
}
