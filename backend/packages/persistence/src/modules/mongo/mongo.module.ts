import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Database } from '@packages/common';
import { MongoConfig, mongoConfig } from 'configs';
import { MongoMigrationModule, MongoMigrationModuleParams } from 'modules/mongo-migration';
import { MONGO_CONFIG_SERVICE } from 'modules/mongo/mongo.constants';
import { Connection } from 'mongoose';
import { MongoIdPlugin } from 'plugins';

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
}
