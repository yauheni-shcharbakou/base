import { z, ZodObject, ZodRawShape } from 'zod';

export type SchemaTypeOf<ValidationSchema extends ZodRawShape> = z.infer<
  ZodObject<ValidationSchema>
>;
