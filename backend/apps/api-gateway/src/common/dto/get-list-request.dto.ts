import { ApiProperty } from '@nestjs/swagger';
import {
  GrpcCrudConditionalFilter,
  GrpcCrudConditionalOperator,
  GrpcCrudLogicalFilter,
  GrpcCrudLogicalOperator,
  GrpcCrudSort,
  GrpcCrudSorter,
  GrpcGetListRequest,
  GrpcPagination,
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

class CrudLogicalFilterDto implements GrpcCrudLogicalFilter {
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

  @ApiProperty({ enum: GrpcCrudLogicalOperator, enumName: 'GrpcCrudLogicalOperator' })
  @IsNotEmpty()
  @IsEnum(GrpcCrudLogicalOperator)
  operator: GrpcCrudLogicalOperator;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  string?: string;
}

class CrudConditionalFilterDto implements GrpcCrudConditionalFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ enum: GrpcCrudConditionalOperator, enumName: 'GrpcCrudConditionalOperator' })
  @IsNotEmpty()
  @IsEnum(GrpcCrudConditionalOperator)
  operator: GrpcCrudConditionalOperator;

  @ApiProperty({ required: false, type: [CrudLogicalFilterDto] })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CrudLogicalFilterDto)
  value: CrudLogicalFilterDto[] = [];
}

class CrudSorterDto implements GrpcCrudSorter {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  field: string;

  @ApiProperty({ enum: GrpcCrudSort, enumName: 'GrpcCrudSort' })
  @IsNotEmpty()
  @IsEnum(GrpcCrudSort)
  order: GrpcCrudSort;
}

class PaginationDto implements GrpcPagination {
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

export class GetListRequestDto implements GrpcGetListRequest {
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
