import {
  AUTH_TOKEN_ALGORITHM,
  AuthTokenAudience,
  commonConfig,
  decodeBase64Pem,
  getAuthTokenIssuer,
} from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  JWT_ACCESS_PRIVATE_KEY_BASE64: zod.string(),
  JWT_ACCESS_PUBLIC_KEY_BASE64: zod.string(),
  REFRESH_JWT_SECRET: zod.string(),
});

export const jwtConfig = () => {
  const common = commonConfig();
  const issuer = getAuthTokenIssuer(common.isDevelopment);

  return {
    ...common,
    accessToken: {
      privateKey: decodeBase64Pem(env.JWT_ACCESS_PRIVATE_KEY_BASE64),
      publicKey: decodeBase64Pem(env.JWT_ACCESS_PUBLIC_KEY_BASE64),
      algorithm: AUTH_TOKEN_ALGORITHM,
      expiresIn: common.isDevelopment ? '1d' : '10m',
      issuer,
      audience: AuthTokenAudience.ACCESS,
    },
    refreshToken: {
      secret: env.REFRESH_JWT_SECRET,
      expiresIn: common.isDevelopment ? '7d' : '1h',
      issuer,
      audience: AuthTokenAudience.REFRESH,
    },
  } as const;
};

export type JwtConfig = ReturnType<typeof jwtConfig>;
