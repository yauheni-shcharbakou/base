import { Module } from '@nestjs/common';
import { CryptoModule } from 'common/modules/crypto/crypto.module';
import { UserRepositoryModule } from 'common/repositories/user/user.repository.module';
import { UserServiceImpl } from 'modules/user/service/impl/user.service.impl';
import { USER_SERVICE } from 'modules/user/service/user.service';

@Module({
  imports: [CryptoModule, UserRepositoryModule],
  providers: [
    {
      provide: USER_SERVICE,
      useClass: UserServiceImpl,
    },
  ],
  exports: [USER_SERVICE],
})
export class UserServiceModule {}
