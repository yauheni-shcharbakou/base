import { Injectable, PipeTransform } from '@nestjs/common';
import { transformGrpcData } from 'modules/grpc/helpers';

@Injectable()
export class GrpcTransformDataPipe implements PipeTransform {
  transform(value: any) {
    return transformGrpcData(value);
  }
}
