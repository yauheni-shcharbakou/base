import { Module } from '@nestjs/common';
import { TempCodeRepositoryModule } from 'common/repositories/temp-code/temp-code.repository.module';
import { TempCodeServiceImpl } from 'modules/temp-code/service/impl/temp-code.service.impl';
import { TEMP_CODE_SERVICE } from 'modules/temp-code/service/temp-code.service';

@Module({
  imports: [TempCodeRepositoryModule],
  providers: [
    {
      provide: TEMP_CODE_SERVICE,
      useClass: TempCodeServiceImpl,
    },
  ],
  exports: [TEMP_CODE_SERVICE],
})
export class TempCodeServiceModule {}
