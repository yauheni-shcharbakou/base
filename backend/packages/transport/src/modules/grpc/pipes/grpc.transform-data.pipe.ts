import { Injectable, PipeTransform } from '@nestjs/common';
import { GrpcDataMapper } from 'modules/grpc/mappers';

@Injectable()
export class GrpcTransformDataPipe implements PipeTransform {
  transform(value: any) {
    return GrpcDataMapper.inTraffic()(value);
  }
}
