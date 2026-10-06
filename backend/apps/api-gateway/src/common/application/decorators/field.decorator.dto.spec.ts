import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { NestStorage } from '@backend/proto';
import { ImageCreateDto } from '@modules/image/application/dto/image.create.dto';
import { StorageObjectCreateDto } from '@modules/storage-object/application/dto/storage-object.create.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BooleanField,
  NumberField,
  ObjectField,
  StringField,
  ULIDField,
} from './field.decorator.dto';

const ULID = '01HZX3Q8J6N2V4K7M9P0R1S2T3';

class NestedDto {
  @StringField()
  value: string;
}

class FieldsDto {
  @ULIDField()
  id: string;

  @ULIDField({ required: false })
  parent?: string;

  @StringField()
  name: string;

  @BooleanField()
  isPublic: boolean;

  @NumberField()
  size: number;

  @ObjectField(NestedDto)
  nested: NestedDto;

  @ObjectField(NestedDto, { required: false })
  extra?: NestedDto;
}

const failedFields = (Dto: new () => object, plain: object): string[] =>
  validateSync(plainToInstance(Dto, plain)).map(({ property }) => property);

// What the gRPC loader (`defaults: true`) hands over: every plain scalar at least at its default,
// an unset message as null, an unset `optional` field as undefined.
const valid = {
  id: ULID,
  name: 'a',
  isPublic: false,
  size: 0,
  nested: { value: 'b' },
  extra: null,
};

describe('field decorators', () => {
  it('accept proto3 defaults of a required boolean or number, and unset optional fields', () => {
    expect(failedFields(FieldsDto, valid)).toEqual([]);
  });

  it('refuse a missing required field', () => {
    expect(
      failedFields(FieldsDto, { ...valid, id: undefined, name: '', nested: null }).sort(),
    ).toEqual(['id', 'name', 'nested']);
  });
});

// DTOs whose proto field is optional or may legitimately be empty.
describe('request DTOs', () => {
  it('create a storage object without a parent', () => {
    const plain = { name: 'a', isPublic: false, type: NestStorage.StorageObjectType.FOLDER };

    expect(failedFields(StorageObjectCreateDto, { ...plain, userId: ULID })).toEqual([]);
  });

  it('create an image with an empty alt', () => {
    expect(failedFields(ImageCreateDto, { width: 1, height: 1, alt: '' })).toEqual([]);
  });
});
