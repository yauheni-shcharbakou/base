import { CacheService } from '@backend/cache';
import { PgModule } from '@backend/pg';
import { RedisModule, RedisUserTransport } from '@backend/event-bus-redis';
import { AuthSessionModule } from '@modules/auth/auth-session.module';
import { CryptoModule } from '@modules/crypto/crypto.module';
import { Module } from '@nestjs/common';
import { UserCreateOneUseCase } from './application/use-cases/user.create-one.use-case';
import { UserDeleteUseCase } from './application/use-cases/user.delete.use-case';
import { UserEnsureAdminUseCase } from './application/use-cases/user.ensure-admin.use-case';
import { UserGetUseCase } from './application/use-cases/user.get.use-case';
import { UserUpdateOneUseCase } from './application/use-cases/user.update-one.use-case';
import { USER_CACHE } from './domain/constants/user.tokens';
import { UserRepository } from './domain/repositories/user.repository';
import { PgUserEntity } from './infrastructure/pg/entities/pg.user.entity';
import { PgUserRepositoryImpl } from './infrastructure/pg/repositories/pg.user.repository.impl';
import { GrpcUserController } from './interface/grpc/grpc.user.controller';
import { LifecycleUserSeeder } from './interface/lifecycle/lifecycle.user.seeder';

@Module({
  imports: [
    PgModule.forFeature(PgUserEntity),
    RedisModule.forFeature({ EventBus: RedisUserTransport.EventBus }),
    CryptoModule,
    AuthSessionModule,
  ],
  providers: [
    {
      provide: UserRepository,
      useClass: PgUserRepositoryImpl,
    },
    {
      // The global CacheService bound to this module's namespace, so a use-case caches under
      // `cache:auth:user:<id>` without repeating the segment — and `deleteByPrefix()` with no
      // argument clears exactly this scope.
      provide: USER_CACHE,
      useFactory: (cacheService: CacheService): CacheService => cacheService.scope('user'),
      inject: [CacheService],
    },
    UserGetUseCase,
    UserDeleteUseCase,
    UserCreateOneUseCase,
    UserUpdateOneUseCase,
    UserEnsureAdminUseCase,
    LifecycleUserSeeder,
  ],
  controllers: [GrpcUserController],
  exports: [UserRepository, USER_CACHE],
})
export class UserModule {}
