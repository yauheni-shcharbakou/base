import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { Database } from '@packages/common';
import { Connection } from 'mongoose';
import { DATABASE_RUNNER_SERVICE, EmptyDatabaseRunnerServiceImpl } from '@backend/common';
import { MongoEntity, convertEntitiesToMongoDefinitions } from './infrastructure';
import { mongoConfig, MongoConfig } from './infrastructure/configs';
import { MongoIdPlugin } from './infrastructure/plugins';

type MongoModuleForRootParams = {
  database: Database;
};

export class MongoModule {
  static forRoot(params: MongoModuleForRootParams): DynamicModule {
    return {
      imports: [
        ConfigModule.forFeature(mongoConfig),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<MongoConfig>) => {
            const mongoOptions = configService.getOrThrow('mongo', { infer: true })(
              params.database,
            );

            return {
              ...mongoOptions,
              connectionFactory: (connection: Connection) => {
                connection.plugin(MongoIdPlugin);
                return connection;
              },
            };
          },
        }),
      ],
      providers: [
        {
          provide: DATABASE_RUNNER_SERVICE,
          useClass: EmptyDatabaseRunnerServiceImpl,
        },
      ],
      exports: [DATABASE_RUNNER_SERVICE],
      global: true,
      module: MongoModule,
    };
  }

  static forFeature(...entities: Type<MongoEntity>[]): DynamicModule {
    const definitions: ModelDefinition[] = convertEntitiesToMongoDefinitions(entities);
    const mongooseModule = MongooseModule.forFeature(definitions);

    return {
      imports: [mongooseModule],
      exports: [mongooseModule],
      module: MongoModule,
    };
  }
}
