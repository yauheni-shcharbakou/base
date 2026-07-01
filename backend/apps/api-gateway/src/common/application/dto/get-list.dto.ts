import { NestCommon } from '@backend/proto';
import { ArrayMaxSize, IsPositive, Max } from 'class-validator';
import {
  BooleanField,
  EnumField,
  NumberField,
  ObjectField,
  StringField,
} from '../decorators/field.decorator.dto';

class LogicalFilterDto implements NestCommon.LogicalFilter {
  @BooleanField({ required: false })
  boolean?: boolean;

  @StringField()
  field: string;

  @NumberField({ required: false })
  number?: number;

  @EnumField(NestCommon.LogicalOperator, { enumName: 'LogicalOperator' })
  operator: NestCommon.LogicalOperator;

  @StringField({ required: false })
  string?: string;
}

class ConditionalFilterDto implements NestCommon.ConditionalFilter {
  @StringField({ required: false })
  key?: string;

  @EnumField(NestCommon.ConditionalOperator, { enumName: 'ConditionalOperator' })
  operator: NestCommon.ConditionalOperator;

  @ObjectField(LogicalFilterDto, { required: false, isArray: true })
  @ArrayMaxSize(100)
  value: LogicalFilterDto[] = [];
}

class SorterDto implements NestCommon.Sorter {
  @StringField()
  field: string;

  @EnumField(NestCommon.Sort, { enumName: 'Sort' })
  order: NestCommon.Sort;
}

class PaginationDto implements NestCommon.Pagination {
  @NumberField({ required: false })
  @IsPositive()
  page?: number;

  @NumberField({ required: false })
  @IsPositive()
  @Max(1_000)
  limit?: number;
}

export class GetListDto implements NestCommon.GetList {
  @ObjectField(ConditionalFilterDto, { required: false, isArray: true })
  @ArrayMaxSize(100)
  conditionalFilters: ConditionalFilterDto[] = [];

  @ObjectField(LogicalFilterDto, { required: false, isArray: true })
  @ArrayMaxSize(100)
  logicalFilters: LogicalFilterDto[] = [];

  @ObjectField(PaginationDto, { required: false })
  pagination?: PaginationDto;

  @ObjectField(SorterDto, { required: false, isArray: true })
  @ArrayMaxSize(10)
  sorters: SorterDto[] = [];
}
