import { NodeValidationSchema, validateEnv } from '@packages/common';
import zod from 'zod';

export class ConfigService {
  private readonly env = validateEnv({
    ...NodeValidationSchema,
    BACKEND_GRPC_URL: zod.string().default('0.0.0.0:8000'),
    // The header the proxy in front of this server overwrites with the client's address. The
    // gateway limits sign-in attempts per that address, so a header the client can write itself
    // would let it pick a new one for every attempt.
    CLIENT_IP_HEADER: zod.string().default('x-real-ip'),
    DEFAULT_EMAIL: zod.email().default('admin@gmail.com'),
    DEFAULT_PASSWORD: zod.string().default('string123'),
  });

  public readonly isDevelopment = this.env.NODE_ENV === 'development';

  private readonly config = {
    isDevelopment: this.isDevelopment,
    backend: {
      grpcUrl: this.env.BACKEND_GRPC_URL,
    },
    clientIpHeader: this.env.CLIENT_IP_HEADER,
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

  getClientIpHeader() {
    return this.config.clientIpHeader;
  }

  getDefaultAuth() {
    return this.config.defaultAuth;
  }
}
