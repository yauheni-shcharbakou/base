import { Module } from '@nestjs/common';
import { TempCodeRpcController } from 'modules/temp-code/rpc/temp-code.rpc.controller';
import { TempCodeServiceModule } from 'modules/temp-code/service/temp-code.service.module';

@Module({
  imports: [TempCodeServiceModule],
  controllers: [TempCodeRpcController],
})
export class TempCodeRpcModule {}
