import { Prop } from '@nestjs/mongoose';
import mongoose, { SchemaTypeOptions, Types } from 'mongoose';

export const MongooseSchemaType = { ...mongoose.Schema.Types } as const;

type SchemaType = (typeof MongooseSchemaType)[keyof typeof MongooseSchemaType];
type Options<FieldType> = Omit<SchemaTypeOptions<FieldType>, 'type'>;

const propDecoratorFactory = <FieldType>(
  type: SchemaType | SchemaType[],
  defaultOptions: Options<FieldType> = {},
) => {
  return (options: Options<FieldType> = {}): PropertyDecorator => {
    return Prop({ type, ...defaultOptions, ...options });
  };
};

export const StringProp = propDecoratorFactory<string>(MongooseSchemaType.String);
export const StringArrayProp = propDecoratorFactory<string[]>([MongooseSchemaType.String]);

export const NumberProp = propDecoratorFactory<number>(MongooseSchemaType.Number);
export const NumberArrayProp = propDecoratorFactory<number[]>([MongooseSchemaType.Number]);

export const BooleanProp = propDecoratorFactory<boolean>(MongooseSchemaType.Boolean);
export const BooleanArrayProp = propDecoratorFactory<boolean[]>([MongooseSchemaType.Boolean]);

export const DateProp = propDecoratorFactory<Date>(MongooseSchemaType.Date);
export const DateArrayProp = propDecoratorFactory<Date[]>([MongooseSchemaType.Date]);

export const MapProp = propDecoratorFactory<Map<any, any>>(MongooseSchemaType.Map);
export const MapArrayProp = propDecoratorFactory<Map<any, any>[]>([MongooseSchemaType.Map]);

export const BufferProp = propDecoratorFactory<Types.Buffer>(MongooseSchemaType.Buffer);
export const BufferArrayProp = propDecoratorFactory<Types.Buffer[]>([MongooseSchemaType.Buffer]);

const defaultObjectIdOptions: Options<Types.ObjectId> = {
  index: true,
  get: (value: Types.ObjectId | undefined) => value?.toString(),
  transform: (fn: any): any => fn,
};

export const ObjectIdProp = propDecoratorFactory<Types.ObjectId>(
  MongooseSchemaType.ObjectId,
  defaultObjectIdOptions,
);

export const ObjectIdArrayProp = propDecoratorFactory<Types.ObjectId[]>(
  [MongooseSchemaType.ObjectId],
  defaultObjectIdOptions,
);

export const UuidProp = propDecoratorFactory<string>(MongooseSchemaType.UUID);
export const UuidArrayProp = propDecoratorFactory<string[]>([MongooseSchemaType.UUID]);

export const ArrayProp = propDecoratorFactory<any[]>(MongooseSchemaType.Array);
export const MixedProp = propDecoratorFactory<any>(MongooseSchemaType.Mixed);
