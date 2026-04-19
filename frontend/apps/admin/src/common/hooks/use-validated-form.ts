'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SchemaTypeOf } from '@packages/common';
import { HttpError } from '@refinedev/core';
import { useForm, UseFormProps, UseFormReturnType } from '@refinedev/react-hook-form';
import { FieldValues } from 'react-hook-form';
import zod, { ZodRawShape } from 'zod';

type ReturnedType<
  ValidationSchema extends ZodRawShape,
  Input extends FieldValues = SchemaTypeOf<ValidationSchema>,
  Output extends FieldValues = SchemaTypeOf<ValidationSchema>,
> = UseFormReturnType<Input, HttpError, Output> & {
  providerData?: Input;
};

export const useValidatedForm = <
  ValidationSchema extends ZodRawShape,
  Input extends FieldValues = SchemaTypeOf<ValidationSchema>,
  Output extends FieldValues = SchemaTypeOf<ValidationSchema>,
>(
  schema: ValidationSchema,
  props: Omit<UseFormProps<Input, HttpError, Output>, 'resolver'> = {},
): ReturnedType<ValidationSchema, Input, Output> => {
  const result = useForm<Input, HttpError, Output>({
    ...props,
    resolver: zodResolver(zod.object(schema)) as any,
  });

  const providerData = result.refineCore.query?.data?.data;
  return { ...result, providerData };
};
