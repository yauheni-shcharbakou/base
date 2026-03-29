import { PostgresModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { TempCodeEntity } from 'common/repositories/temp-code/entities/temp-code.entity';
import { TempCodeRepositoryImpl } from 'common/repositories/temp-code/impl/temp-code.repository.impl';
import { TEMP_CODE_REPOSITORY } from 'common/repositories/temp-code/temp-code.repository';

@Module({
  imports: [PostgresModule.forFeature(TempCodeEntity)],
  providers: [
    {
      provide: TEMP_CODE_REPOSITORY,
      useClass: TempCodeRepositoryImpl,
    },
  ],
  exports: [TEMP_CODE_REPOSITORY],
})
export class TempCodeRepositoryModule {}
