import { applyDecorators, Type as ClassType } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TransformToArray, TransformToBoolean, TransformToDate } from './transform.decorator';
import { IsULID } from './validation.decorator';

type FieldOptions = {
  required?: false;
  isArray?: true;
};

export const ULIDField = (options?: FieldOptions) => {
  const isArray = !!options?.isArray;
  const type: ApiPropertyOptions['type'] = isArray ? [String] : String;

  const decorators: PropertyDecorator[] = [
    ApiProperty({ type } as ApiPropertyOptions),
    IsULID({ each: isArray }),
  ];

  decorators.push(options?.required ? IsNotEmpty() : IsOptional());

  if (isArray) {
    decorators.push(TransformToArray());
  }

  return applyDecorators(...decorators);
};

export const StringField = (options?: FieldOptions) => {
  const isArray = !!options?.isArray;
  const type: ApiPropertyOptions['type'] = isArray ? [String] : String;

  const decorators: PropertyDecorator[] = [
    ApiProperty({ type } as ApiPropertyOptions),
    IsString({ each: isArray }),
  ];

  decorators.push(options?.required ? IsNotEmpty() : IsOptional());

  if (isArray) {
    decorators.push(TransformToArray());
  }

  return applyDecorators(...decorators);
};

export const BooleanField = (options?: Omit<FieldOptions, 'isArray'>) => {
  const decorators: PropertyDecorator[] = [
    ApiProperty({ type: Boolean, required: options?.required }),
    IsBoolean(),
    TransformToBoolean(),
  ];

  decorators.push(options?.required ? IsNotEmpty() : IsOptional());
  return applyDecorators(...decorators);
};

export const NumberField = (options?: Omit<FieldOptions, 'isArray'>) => {
  const decorators: PropertyDecorator[] = [
    ApiProperty({ type: Number, required: options?.required }),
    IsNumber(),
    Type(() => Number),
  ];

  decorators.push(options?.required ? IsNotEmpty() : IsOptional());
  return applyDecorators(...decorators);
};

export const DateField = (options?: Omit<FieldOptions, 'isArray'>) => {
  const decorators: PropertyDecorator[] = [
    ApiProperty({ type: Date, required: options?.required }),
    IsDate(),
    TransformToDate(),
  ];

  decorators.push(options?.required ? IsNotEmpty() : IsOptional());
  return applyDecorators(...decorators);
};

export const ObjectField = (Dto: ClassType, options?: FieldOptions) => {
  const isArray = !!options?.isArray;
  const type: ApiPropertyOptions['type'] = isArray ? [Dto] : Dto;

  const decorators: PropertyDecorator[] = [
    ApiProperty({ type, required: options?.required } as ApiPropertyOptions),
    IsObject({ each: isArray }),
    ValidateNested({ each: isArray }),
    Type(() => Dto),
  ];

  decorators.push(options?.required ? IsNotEmpty() : IsOptional());

  if (isArray) {
    decorators.push(TransformToArray());
  }

  return applyDecorators(...decorators);
};

type EnumFieldOptions = FieldOptions & {
  enumName?: string;
};

export const EnumField = (enumType: ApiPropertyOptions['enum'], options?: EnumFieldOptions) => {
  const isArray = !!options.isArray;

  const decorators: PropertyDecorator[] = [
    ApiProperty({
      required: options.required,
      enum: enumType,
      enumName: options.enumName,
      isArray,
    }),
    IsEnum(enumType, { each: isArray }),
  ];

  decorators.push(options.required ? IsNotEmpty() : IsOptional());

  if (isArray) {
    decorators.push(TransformToArray());
  }

  return applyDecorators(...decorators);
};
