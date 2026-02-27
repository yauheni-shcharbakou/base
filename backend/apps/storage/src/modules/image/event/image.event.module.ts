import { Module } from '@nestjs/common';
import { ImageEventController } from 'modules/image/event/image.event.controller';
import { ImageServiceModule } from 'modules/image/service/image.service.module';

@Module({
  imports: [ImageServiceModule],
  controllers: [ImageEventController],
})
export class ImageEventModule {}
