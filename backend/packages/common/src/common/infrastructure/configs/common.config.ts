import { NodeValidationSchema, validateEnv } from '@packages/common';

const env = validateEnv(NodeValidationSchema);

export const commonConfig = () =>
  ({
    port: env.PORT || 10000,
    isDevelopment: env.NODE_ENV === 'development',
  }) as const;

export type CommonConfig = ReturnType<typeof commonConfig>;
