import { MongooseModuleOptions } from '@nestjs/mongoose';
import { DatabaseValidationSchema, validateEnv } from '@packages/common';

const env = validateEnv(DatabaseValidationSchema);

export const mongoConfig = () =>
  ({
    mongo: <MongooseModuleOptions>{
      uri: env.DATABASE_URL ?? 'mongodb://localhost:27017',
      dbName: env.DATABASE_NAME,
      autoIndex: true,
      autoCreate: true,
    },
  }) as const;

export type MongoConfig = ReturnType<typeof mongoConfig>;
