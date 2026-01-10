import Joi from 'joi';
import { EnvironmentOf } from 'validation/types';

export const NodeValidationSchema = {
  PORT: Joi.alternatives<string | number>(Joi.string(), Joi.number()).optional(),
  NODE_ENV: Joi.string<'development' | 'production'>()
    .valid('development', 'production')
    .optional(),
} as const;

export const DatabaseValidationSchema = {
  DATABASE_URL: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
} as const;

export type NodeEnvironment = EnvironmentOf<typeof NodeValidationSchema>;
export type DatabaseEnvironment = EnvironmentOf<typeof DatabaseValidationSchema>;
