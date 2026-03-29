'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SchemaTypeOf } from '@packages/common';
import { HttpError } from '@refinedev/core';
import { useForm, UseFormProps, UseFormReturnType } from '@refinedev/react-hook-form';
import { FieldValues } from 'react-hook-form';
import zod, { ZodRawShape } from 'zod';

export const useValidatedForm = <
  ValidationSchema extends ZodRawShape,
  Input extends FieldValues = SchemaTypeOf<ValidationSchema>,
  Output extends FieldValues = SchemaTypeOf<ValidationSchema>,
>(
  schema: ValidationSchema,
  props: Omit<UseFormProps<Input, HttpError, Output>, 'resolver'> = {},
): UseFormReturnType<Input, HttpError, Output> => {
  return useForm<Input, HttpError, Output>({
    ...props,
    resolver: zodResolver(zod.object(schema)) as any,
  });
};
