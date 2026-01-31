import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoServiceImpl } from 'common/modules/crypto/impl/crypto.service.impl';
import { Config } from 'config';
import { CRYPTO_SERVICE } from './crypto.service';

@Module({
  providers: [
    {
      provide: CRYPTO_SERVICE,
      useFactory: (configService: ConfigService<Config>) => {
        return new CryptoServiceImpl(configService.get('hashing.saltRounds', { infer: true }));
      },
      inject: [ConfigService],
    },
  ],
  exports: [CRYPTO_SERVICE],
})
export class CryptoModule {}
