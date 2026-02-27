import { Module } from '@nestjs/common';
import { ImageEventModule } from 'modules/image/event/image.event.module';
import { ImageRpcModule } from 'modules/image/rpc/image.rpc.module';

@Module({
  imports: [ImageEventModule, ImageRpcModule],
})
export class ImageModule {}
