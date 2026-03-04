import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { Database } from '@packages/common';
import { PERSISTENCE_SERVICE, PersistenceServiceImpl } from 'common';
import { MongoEntity } from 'mongo/entities';
import { convertEntitiesToMongoDefinitions } from 'mongo/helpers';
import { MongoConfig, mongoConfig } from 'mongo/mongo.config';
import { MONGO_CONFIG_SERVICE } from 'mongo/mongo.constants';
import { Connection } from 'mongoose';
import { MongoIdPlugin } from 'mongo/plugins';

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
          provide: MONGO_CONFIG_SERVICE,
          useClass: ConfigService,
        },
        {
          provide: PERSISTENCE_SERVICE,
          useClass: PersistenceServiceImpl,
        },
      ],
      exports: [MONGO_CONFIG_SERVICE, PERSISTENCE_SERVICE],
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
