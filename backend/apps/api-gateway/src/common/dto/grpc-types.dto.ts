import { GrpcBaseQuery, GrpcEntityWithTimestamps } from '@backend/grpc';
import { UpdateIncOf, UpdateOf, UpdateRemoveOf, UpdateSetOf } from '@backend/persistence';
import { Type as DtoType } from '@nestjs/common';
import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { IdFieldDto } from 'common/dto/id-field.dto';
import {
  ItemsType,
  RequestType,
  UpdateByIdRequestType,
  UpdateRequestType,
} from 'common/interfaces/grpc-types.interface';
import _ from 'lodash';

export const ItemsDto = <Item extends object>(ItemDto: DtoType<Item>): DtoType<ItemsType<Item>> => {
  class DynamicItemsDto implements ItemsType<Item> {
    @ApiProperty({ type: [ItemDto] })
    @IsNotEmpty()
    @IsObject({ each: true })
    @ValidateNested({ each: true })
    @Type(() => ItemDto)
    items: Item[];
  }

  return DynamicItemsDto;
};

export const RequestDto = <Query extends GrpcBaseQuery>(
  QueryDto: DtoType<Query>,
): DtoType<RequestType<Query>> => {
  class DynamicRequestDto implements RequestType<Query> {
    @ApiProperty({ required: false, type: QueryDto })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => QueryDto)
    query?: Query;
  }

  return DynamicRequestDto;
};

export const UpdateDto = <Entity extends GrpcEntityWithTimestamps>(
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
    @ApiProperty({ required: false, type: DynamicUpdateSetDto })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => DynamicUpdateSetDto)
    set?: UpdateSetOf<Entity>;

    @ApiProperty({ required: false, enum: RemoveFieldsEnum })
    @IsOptional()
    @IsEnum(RemoveFieldsEnum)
    remove?: UpdateRemoveOf<Entity>;

    @ApiProperty({ required: false, type: DynamicUpdateIncDto })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => DynamicUpdateIncDto)
    inc?: UpdateIncOf<Entity>;
  }

  return DynamicUpdateDto;
};

export const UpdateRequestDto = <Query extends GrpcBaseQuery, Update extends UpdateOf<any>>(
  QueryDto: DtoType<Query>,
  UpdateDto: DtoType<Update>,
): DtoType<UpdateRequestType<Query, Update>> => {
  class DynamicUpdateRequestDto implements UpdateRequestType<Query, Update> {
    @ApiProperty({ type: QueryDto })
    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => QueryDto)
    query: Query;

    @ApiProperty({ type: UpdateDto })
    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => UpdateDto)
    update: Update;
  }

  return DynamicUpdateRequestDto;
};

export const UpdateByIdRequestDto = <Update extends UpdateOf<any>>(
  UpdateDto: DtoType<Update>,
): DtoType<UpdateByIdRequestType<Update>> => {
  class DynamicUpdateRequestDto extends IdFieldDto implements UpdateByIdRequestType<Update> {
    @ApiProperty({ type: UpdateDto })
    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => UpdateDto)
    update: Update;
  }

  return DynamicUpdateRequestDto;
};
