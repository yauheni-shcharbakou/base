import { NatsAuthUserTransport, NatsModule } from '@backend/nats';
import { PgModule } from '@backend/pg';
import { CryptoModule } from '@modules/crypto/crypto.module';
import { Module } from '@nestjs/common';
import { UserCreateOneUseCase } from './application/use-cases/user.create-one.use-case';
import { UserDeleteUseCase } from './application/use-cases/user.delete.use-case';
import { UserGetUseCase } from './application/use-cases/user.get.use-case';
import { UserUpdateOneUseCase } from './application/use-cases/user.update-one.use-case';
import { UserRepository } from './domain/repositories/user.repository';
import { PgUserEntity } from './infrastructure/pg/entities/pg.user.entity';
import { PgUserRepositoryImpl } from './infrastructure/pg/repositories/pg.user.repository.impl';
import { GrpcUserController } from './interface/grpc/grpc.user.controller';

@Module({
  imports: [
    PgModule.forFeature(PgUserEntity),
    NatsModule.forFeature({ EventBus: NatsAuthUserTransport.EventBus }),
    CryptoModule,
  ],
  providers: [
    {
      provide: UserRepository,
      useClass: PgUserRepositoryImpl,
    },
    UserGetUseCase,
    UserDeleteUseCase,
    UserCreateOneUseCase,
    UserUpdateOneUseCase,
  ],
  controllers: [GrpcUserController],
  exports: [UserRepository],
})
export class UserModule {}
