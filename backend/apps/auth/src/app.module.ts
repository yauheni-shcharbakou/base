import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import { migrationTasks } from 'common/migrations';
import { CryptoModule } from 'common/modules/crypto/crypto.module';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';
import { UserModule } from 'modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongoModule.forRoot({
      database: Database.AUTH,
      migration: {
        imports: [ConfigModule, CryptoModule],
        tasks: migrationTasks,
        entities: [UserEntity],
      },
    }),
    GrpcModule.forRoot({ host: 'auth' }),
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
