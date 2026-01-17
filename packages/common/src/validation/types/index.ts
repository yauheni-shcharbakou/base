import { z, ZodObject, ZodRawShape } from 'zod';

export type EnvironmentOf<ValidationSchema extends ZodRawShape> = z.infer<
  ZodObject<ValidationSchema>
>;
