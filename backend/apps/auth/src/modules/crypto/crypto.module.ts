import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CryptoService } from './domain/services/crypto.service';
import { bcryptConfig, BcryptConfig } from './infrastructure/configs/bcrypt.config';
import { BcryptCryptoServiceImpl } from './infrastructure/services/bcrypt.crypto.service.impl';

@Module({
  imports: [ConfigModule.forFeature(bcryptConfig)],
  providers: [
    {
      provide: CryptoService,
      useFactory: (configService: ConfigService<BcryptConfig>) => {
        return new BcryptCryptoServiceImpl(
          configService.get('hashing.saltRounds', { infer: true }),
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [CryptoService],
})
export class CryptoModule {}
