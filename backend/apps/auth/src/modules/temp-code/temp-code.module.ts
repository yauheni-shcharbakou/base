import { PgModule } from '@backend/pg';
import { Module } from '@nestjs/common';
import { TempCodeCreateOneUseCase } from './application/use-cases/temp-code.create-one.use-case';
import { TempCodeDeactivateExpiredUseCase } from './application/use-cases/temp-code.deactivate-expired.use-case';
import { TempCodeDeactivateOneUseCase } from './application/use-cases/temp-code.deactivate-one.use-case';
import { TempCodeDeleteUseCase } from './application/use-cases/temp-code.delete.use-case';
import { TempCodeGetUseCase } from './application/use-cases/temp-code.get.use-case';
import { TempCodeRepository } from './domain/repositories/temp-code.repository';
import { PgTempCodeEntity } from './infrastructure/pg/entities/pg.temp-code.entity';
import { PgTempCodeRepositoryImpl } from './infrastructure/pg/repositories/pg.temp-code.repository.impl';
import { CronTempCodeScheduler } from './interface/cron/cron.temp-code.scheduler';
import { GrpcTempCodeController } from './interface/grpc/grpc.temp-code.controller';

@Module({
  imports: [PgModule.forFeature(PgTempCodeEntity)],
  providers: [
    {
      provide: TempCodeRepository,
      useClass: PgTempCodeRepositoryImpl,
    },
    TempCodeGetUseCase,
    TempCodeDeleteUseCase,
    TempCodeDeactivateOneUseCase,
    TempCodeCreateOneUseCase,
    TempCodeDeactivateExpiredUseCase,
    CronTempCodeScheduler,
  ],
  controllers: [GrpcTempCodeController],
})
export class TempCodeModule {}
