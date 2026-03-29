import { Module } from '@nestjs/common';
import { TempCodeEventController } from 'modules/temp-code/event/temp-code.event.controller';
import { TempCodeServiceModule } from 'modules/temp-code/service/temp-code.service.module';

@Module({
  imports: [TempCodeServiceModule],
  controllers: [TempCodeEventController],
})
export class TempCodeEventModule {}
