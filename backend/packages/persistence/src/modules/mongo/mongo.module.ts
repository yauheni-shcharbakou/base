import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMigrationModule, MongoMigrationModuleParams } from 'modules/mongo/migration';
import { mongoConfig, MongoConfig } from 'modules/mongo/mongo.config';
import { MONGO_CONFIG_SERVICE } from 'modules/mongo/mongo.constants';

type MongoModuleForRootParams = {
  migration?: MongoMigrationModuleParams;
};

export class MongoModule {
  static forRoot(params: MongoModuleForRootParams = {}): DynamicModule {
    return {
      imports: [
        ConfigModule.forFeature(mongoConfig),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<MongoConfig>) => {
            return configService.getOrThrow('mongo', { infer: true });
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
