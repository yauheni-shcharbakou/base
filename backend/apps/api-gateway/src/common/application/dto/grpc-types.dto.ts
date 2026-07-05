import { UpdateIncOf, UpdateOf, UpdateRemoveOf, UpdateSetOf } from '@backend/common';
import { NestCommon } from '@backend/proto';
import {
  ItemsType,
  RequestType,
  UpdateByIdType,
  UpdateType,
} from '@common/domain/types/grpc.types';
import { Type as DtoType } from '@nestjs/common';
import { OmitType, PartialType, PickType } from '@nestjs/swagger';
import _ from 'lodash';
import { EnumField, ObjectField } from '../decorators/field.decorator.dto';
import { IdFieldDto } from './id-field.dto';

export const ItemsDto = <Item extends object>(ItemDto: DtoType<Item>): DtoType<ItemsType<Item>> => {
  class DynamicItemsDto implements ItemsType<Item> {
    @ObjectField(ItemDto, { isArray: true })
    items: Item[];
  }

  return DynamicItemsDto;
};

export const RequestDto = <Query extends NestCommon.Query>(
  QueryDto: DtoType<Query>,
): DtoType<RequestType<Query>> => {
  class DynamicRequestDto implements RequestType<Query> {
    @ObjectField(QueryDto)
    query: Query;
  }

  return DynamicRequestDto;
};

export const UpdateDto = <Entity extends NestCommon.Entity>(
  EntityDto: DtoType<Entity>,
  remove: UpdateRemoveOf<Entity> = [],
  inc: (keyof UpdateIncOf<Entity>)[] = [],
): DtoType<UpdateOf<Entity>> => {
  const DynamicUpdateSetDto = PartialType(
    OmitType(EntityDto, ['id', 'createdAt', 'updatedAt'] as const),
  );

  const DynamicUpdateIncDto = PartialType(PickType(DynamicUpdateSetDto, inc));

  const RemoveFieldsEnum = _.reduce(
    remove,
    (acc: Partial<Record<keyof UpdateSetOf<Entity>, keyof UpdateSetOf<Entity>>>, field) => {
      acc[field] = field;
      return acc;
    },
    {},
  );

  class DynamicUpdateDto implements UpdateOf<Entity> {
    @ObjectField(DynamicUpdateSetDto, { required: false })
    set?: UpdateSetOf<Entity>;

    @EnumField(RemoveFieldsEnum, { required: false })
    remove?: UpdateRemoveOf<Entity>;

    @ObjectField(DynamicUpdateIncDto, { required: false })
    inc?: UpdateIncOf<Entity>;
  }

  return DynamicUpdateDto;
};

export const UpdateRequestDto = <Query extends NestCommon.Query, Update extends UpdateOf<any>>(
  QueryDto: DtoType<Query>,
  UpdateDto: DtoType<Update>,
): DtoType<UpdateType<Query, Update>> => {
  class DynamicUpdateRequestDto implements UpdateType<Query, Update> {
    @ObjectField(QueryDto)
    query: Query;

    @ObjectField(UpdateDto)
    update: Update;
  }

  return DynamicUpdateRequestDto;
};

export const UpdateByIdRequestDto = <Update extends UpdateOf<any>>(
  UpdateDto: DtoType<Update>,
): DtoType<UpdateByIdType<Update>> => {
  class DynamicUpdateRequestDto extends IdFieldDto implements UpdateByIdType<Update> {
    @ObjectField(UpdateDto)
    update: Update;
  }

  return DynamicUpdateRequestDto;
};
