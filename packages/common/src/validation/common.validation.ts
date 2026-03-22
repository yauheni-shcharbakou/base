import { SchemaTypeOf } from 'validation/types';
import zod from 'zod';

export const NodeValidationSchema = {
  PORT: zod.coerce.number().optional(),
  NODE_ENV: zod.enum(['development', 'production']).optional(),
} as const;

export const DatabaseValidationSchema = {
  DATABASE_URL: zod.string(),
} as const;

export type NodeEnvironment = SchemaTypeOf<typeof NodeValidationSchema>;
export type DatabaseEnvironment = SchemaTypeOf<typeof DatabaseValidationSchema>;
