import { Metadata } from '@grpc/grpc-js';
import { BadRequestException } from '@nestjs/common';
import _ from 'lodash';

export class GrpcMetadataMapper {
  private readonly valueByField = new Map<string, string[]>();

  constructor(private readonly meta?: Metadata) {
    const metaJson = meta.toJSON();

    for (const field in metaJson) {
      const values = metaJson[field];

      this.valueByField.set(
        field,
        _.map(values, (value) => value?.toString()),
      );
    }
  }

  get(field: string): string {
    const [value] = this.getArray(field);
    return value ?? '';
  }

  getOrThrow(field: string): string {
    const [value] = this.getArray(field);

    if (!value) {
      throw new BadRequestException(`Grpc meta field ${field} is required`);
    }

    return value;
  }

  getArray(field: string): string[] {
    return this.valueByField.get(field) ?? [];
  }
}
