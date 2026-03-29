import { Module } from '@nestjs/common';
import { ImageRpcModule } from 'modules/image/rpc/image.rpc.module';

@Module({
  imports: [ImageRpcModule],
})
export class ImageModule {}
