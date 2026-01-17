import { Injectable, PipeTransform } from '@nestjs/common';
import { GrpcDataMapper } from 'mappers';

@Injectable()
export class GrpcTransformDataPipe implements PipeTransform {
  transform(value: any) {
    return GrpcDataMapper.inTraffic(value);
  }
}
