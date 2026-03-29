import { Module } from '@nestjs/common';
import { UserRepositoryModule } from 'common/repositories/user/user.repository.module';
import { CryptoServiceModule } from 'common/services/crypto/crypto.service.module';
import { UserServiceImpl } from 'modules/user/service/impl/user.service.impl';
import { USER_SERVICE } from 'modules/user/service/user.service';

@Module({
  imports: [CryptoServiceModule, UserRepositoryModule],
  providers: [
    {
      provide: USER_SERVICE,
      useClass: UserServiceImpl,
    },
  ],
  exports: [USER_SERVICE],
})
export class UserServiceModule {}
