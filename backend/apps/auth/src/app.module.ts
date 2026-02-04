import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { UserEntity, UserSchema } from 'common/entities/user.entity';
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
        entities: [{ name: UserEntity.name, schema: UserSchema }],
      },
    }),
    GrpcModule.forRoot({ host: 'auth' }),
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
