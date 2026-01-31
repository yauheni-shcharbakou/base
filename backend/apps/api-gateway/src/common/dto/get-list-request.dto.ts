import { ApiProperty } from '@nestjs/swagger';
import {
  CrudConditionalFilter,
  CrudConditionalOperator,
  CrudLogicalFilter,
  CrudLogicalOperator,
  CrudSort,
  CrudSorter,
  GetListRequest,
  Pagination,
} from '@backend/grpc';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CrudLogicalFilterDto implements CrudLogicalFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  boolean?: boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  field: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  number?: number;

  @ApiProperty({ enum: CrudLogicalOperator, enumName: 'CrudLogicalOperator' })
  @IsNotEmpty()
  @IsEnum(CrudLogicalOperator)
  operator: CrudLogicalOperator;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  string?: string;
}

class CrudConditionalFilterDto implements CrudConditionalFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ enum: CrudConditionalOperator, enumName: 'CrudConditionalOperator' })
  @IsNotEmpty()
  @IsEnum(CrudConditionalOperator)
  operator: CrudConditionalOperator;

  @ApiProperty({ required: false, type: [CrudLogicalFilterDto] })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CrudLogicalFilterDto)
  value: CrudLogicalFilterDto[] = [];
}

class CrudSorterDto implements CrudSorter {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  field: string;

  @ApiProperty({ enum: CrudSort, enumName: 'CrudSort' })
  @IsNotEmpty()
  @IsEnum(CrudSort)
  order: CrudSort;
}

class PaginationDto implements Pagination {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

export class GetListRequestDto implements GetListRequest {
  @ApiProperty({ required: false, type: [CrudConditionalFilterDto] })
  @IsOptional()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CrudConditionalFilterDto)
  conditionalFilters: CrudConditionalFilterDto[] = [];

  @ApiProperty({ required: false, type: [CrudLogicalFilterDto] })
  @IsOptional()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CrudLogicalFilterDto)
  logicalFilters: CrudLogicalFilterDto[] = [];

  @ApiProperty({ type: PaginationDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination?: PaginationDto;

  @ApiProperty({ required: false, type: [CrudSorterDto] })
  @IsOptional()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CrudSorterDto)
  sorters: CrudSorterDto[] = [];
}
