import { DatabaseRunnerService, EmptyDatabaseRunnerServiceImpl } from '@backend/common';
import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { Database } from '@packages/common';
import { Connection } from 'mongoose';
import { convertEntitiesToMongoDefinitions, MongoEntity } from './infrastructure';
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
          provide: DatabaseRunnerService,
          useClass: EmptyDatabaseRunnerServiceImpl,
        },
      ],
      exports: [DatabaseRunnerService],
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
