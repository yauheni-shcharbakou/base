import { SchemaTypeOf } from '@/validation/types';
import zod from 'zod';

export const NodeValidationSchema = {
  PORT: zod.coerce.number().optional(),
  // `test` is what jest sets. Without it any spec that transitively imports a config module
  // dies at import time on `Env validation failed`. Consumers only ever compare this against
  // `development` / `production`, so the extra member changes no behaviour.
  NODE_ENV: zod.enum(['development', 'production', 'test']).optional(),
} as const;

export const DatabaseValidationSchema = {
  DATABASE_URL: zod.string(),
} as const;

export type NodeEnvironment = SchemaTypeOf<typeof NodeValidationSchema>;
export type DatabaseEnvironment = SchemaTypeOf<typeof DatabaseValidationSchema>;
