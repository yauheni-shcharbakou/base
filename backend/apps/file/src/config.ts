import { commonConfig } from '@backend/common';

export const config = () =>
  ({
    ...commonConfig(),
  }) as const;

export type Config = ReturnType<typeof config>;
