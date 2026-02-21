import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { Database } from '@packages/common';
import { MongoEntity } from 'mongo/entities';
import { convertEntitiesToMongoDefinitions } from 'mongo/helpers';
import { MongoMigrationModule, MongoMigrationModuleParams } from 'mongo/modules/migration';
import { MongoConfig, mongoConfig } from 'mongo/mongo.config';
import { MONGO_CONFIG_SERVICE } from 'mongo/mongo.constants';
import { Connection } from 'mongoose';
import { MongoIdPlugin } from 'mongo/plugins';

type MongoModuleForRootParams = {
  database: Database;
  migration?: MongoMigrationModuleParams;
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
        MongoMigrationModule.register(params.migration),
      ],
      providers: [
        {
          provide: MONGO_CONFIG_SERVICE,
          useClass: ConfigService,
        },
      ],
      exports: [MongooseModule, MONGO_CONFIG_SERVICE],
      global: true,
      module: MongoModule,
    };
  }

  static forFeature(...entities: Type<MongoEntity>[]): DynamicModule {
    const definitions: ModelDefinition[] = convertEntitiesToMongoDefinitions(entities);

    return {
      imports: [MongooseModule.forFeature(definitions)],
      exports: [MongooseModule],
      module: MongoModule,
    };
  }
}
