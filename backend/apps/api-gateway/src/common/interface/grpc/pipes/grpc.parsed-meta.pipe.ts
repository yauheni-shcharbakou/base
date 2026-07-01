import { GrpcParsedMeta } from '@backend/grpc';
import { Metadata } from '@grpc/grpc-js';
import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class GrpcParsedMetaPipe implements PipeTransform<Metadata, GrpcParsedMeta> {
  transform(value: Metadata, metadata: ArgumentMetadata): GrpcParsedMeta {
    if (!value || typeof value.get !== 'function') {
      return new GrpcParsedMeta(new Metadata());
    }

    return new GrpcParsedMeta(value);
  }
}
