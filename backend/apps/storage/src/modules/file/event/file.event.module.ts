import { Module } from '@nestjs/common';
import { FileEventController } from 'modules/file/event/file.event.controller';
import { FileServiceModule } from 'modules/file/service/file.service.module';

@Module({
  imports: [FileServiceModule],
  controllers: [FileEventController],
})
export class FileEventModule {}
