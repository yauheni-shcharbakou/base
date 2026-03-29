import { Module } from '@nestjs/common';
import { TempCodeEventModule } from 'modules/temp-code/event/temp-code.event.module';
import { TempCodeRpcModule } from 'modules/temp-code/rpc/temp-code.rpc.module';

@Module({
  imports: [TempCodeRpcModule, TempCodeEventModule],
})
export class TempCodeModule {}
