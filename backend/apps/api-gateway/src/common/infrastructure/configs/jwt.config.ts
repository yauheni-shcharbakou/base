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
  JWT_ACCESS_PUBLIC_KEY_BASE64: zod.string(),
});

export const jwtConfig = () => {
  const common = commonConfig();

  return {
    accessToken: {
      publicKey: decodeBase64Pem(env.JWT_ACCESS_PUBLIC_KEY_BASE64),
      algorithm: AUTH_TOKEN_ALGORITHM,
      issuer: getAuthTokenIssuer(common.isDevelopment),
      audience: AuthTokenAudience.ACCESS,
    },
  } as const;
};

export type JwtConfig = ReturnType<typeof jwtConfig>;
