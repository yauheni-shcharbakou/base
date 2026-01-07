import { DatabaseValidationSchema, NodeValidationSchema, validateEnv } from '@packages/common';
import Joi from 'joi';
import _ from 'lodash';

const commonValidationSchema = {
  ...NodeValidationSchema,
  ...DatabaseValidationSchema,
  PAYLOAD_SECRET: Joi.string().required(),
};

type CommonEnv = typeof commonValidationSchema;

type CommonConfig<Auth = false> = Auth extends true
  ? {
      isDevelopment: boolean;
      database: {
        url: string;
      };
      payload: {
        secret: string;
      };
      auth: {
        url: string;
      };
    }
  : {
      isDevelopment: boolean;
      database: {
        url: string;
      };
      payload: {
        secret: string;
      };
    };

export const adminConfig = <Auth extends boolean = true, CustomConfig extends object = {}>(
  withAuth: Auth = true as Auth,
  customConfig: CustomConfig = {} as CustomConfig,
): CommonConfig<Auth> & CustomConfig => {
  const validationSchema: CommonEnv & { ADMIN_AUTH_URL?: Joi.StringSchema } =
    commonValidationSchema;

  if (withAuth) {
    validationSchema.ADMIN_AUTH_URL = Joi.string().uri().required();
  }

  const env = validateEnv(validationSchema);

  const config: CommonConfig<true> = {
    isDevelopment: env.NODE_ENV === 'development',
    database: {
      url: env.DATABASE_URL,
    },
    payload: {
      secret: env.PAYLOAD_SECRET,
    },
  } as CommonConfig<true>;

  if (withAuth) {
    config.auth = { url: env.ADMIN_AUTH_URL! };
  }

  return _.merge(config, customConfig);
};
