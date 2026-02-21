import zod, { z, ZodObject, ZodRawShape } from 'zod';

export const validateEnv = <ValidationSchema extends ZodRawShape>(
  schema: ValidationSchema,
): z.infer<ZodObject<ValidationSchema>> => {
  const result = zod.object(schema).safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', zod.prettifyError(result.error));
    throw new Error('Env validation failed');
  }

  return result.data;
};
