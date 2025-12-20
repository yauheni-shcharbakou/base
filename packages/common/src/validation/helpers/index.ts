import dotenv from 'dotenv';
import Joi, { type AnySchema } from 'joi';
import _ from 'lodash';
import { EnvironmentOf } from 'validation/types';

let isEnvParsed = false;

export const validateEnv = <ValidationSchema extends Record<string, AnySchema>>(
  schema: ValidationSchema,
): EnvironmentOf<ValidationSchema> => {
  if (!isEnvParsed) {
    dotenv.config();
    isEnvParsed = true;
  }

  const result = Joi.object(schema).validate(process.env, { allowUnknown: true });

  if (!result.error) {
    return result.value;
  }

  const errorsList = _.reduce(
    result.error.details ?? [],
    (acc: string, { message }) => acc + ' ' + message,
    '',
  );

  throw Error(`Environment validation failed: ${errorsList}`);
};
