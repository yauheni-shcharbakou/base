import { MongooseModuleOptions } from '@nestjs/mongoose';
import { DatabaseValidationSchema, validateEnv } from '@packages/common';

const env = validateEnv(DatabaseValidationSchema);

console.log('DATABASE URL', env.DATABASE_URL);

export const mongoConfig = () =>
  ({
    mongo: <MongooseModuleOptions>{
      uri: env.DATABASE_URL ?? 'mongodb://localhost:27017/main',
      dbName: 'auth',
      autoIndex: true,
      autoCreate: true,
    },
  }) as const;

export type MongoConfig = ReturnType<typeof mongoConfig>;
