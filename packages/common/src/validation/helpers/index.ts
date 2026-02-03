import { config } from 'dotenv';
import zod, { z, ZodObject, ZodRawShape } from 'zod';

let isEnvParsed = false;

export const validateEnv = <ValidationSchema extends ZodRawShape>(
  schema: ValidationSchema,
): z.infer<ZodObject<ValidationSchema>> => {
  if (!isEnvParsed) {
    config({ quiet: true });
    isEnvParsed = true;
  }

  const result = zod.object(schema).safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', zod.prettifyError(result.error));
    throw new Error('Env validation failed');
  }

  return result.data;
};
