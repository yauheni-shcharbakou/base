import { Prop } from '@nestjs/mongoose';
import mongoose, { SchemaTypeOptions, Types } from 'mongoose';

export const MongooseSchemaType = { ...mongoose.Schema.Types } as const;

type SchemaType = (typeof MongooseSchemaType)[keyof typeof MongooseSchemaType];
type Options<FieldType> = Omit<SchemaTypeOptions<FieldType>, 'type'>;

export class MongoProp {
  private static propDecoratorFactory = <FieldType>(
    type: SchemaType | SchemaType[],
    defaultOptions: Options<FieldType> = {},
  ) => {
    return (options: Options<FieldType> = {}): PropertyDecorator => {
      return Prop({ type, ...defaultOptions, ...options });
    };
  };

  private static defaultObjectIdOptions: Options<Types.ObjectId> = {
    index: true,
    get: (value: Types.ObjectId | undefined) => value?.toString(),
    transform: (fn: any): any => fn,
  };

  static String(options: Options<string> = {}) {
    return this.propDecoratorFactory<string>(MongooseSchemaType.String)(options);
  }

  static StringArray(options: Options<string[]> = {}) {
    return this.propDecoratorFactory<string[]>([MongooseSchemaType.String])(options);
  }

  static Number(options: Options<number> = {}) {
    return this.propDecoratorFactory<number>(MongooseSchemaType.Number)(options);
  }

  static NumberArray(options: Options<number[]> = {}) {
    return this.propDecoratorFactory<number[]>([MongooseSchemaType.Number])(options);
  }

  static Boolean(options: Options<boolean> = {}) {
    return this.propDecoratorFactory<boolean>(MongooseSchemaType.Boolean)(options);
  }

  static BooleanArray(options: Options<boolean[]> = {}) {
    return this.propDecoratorFactory<boolean[]>([MongooseSchemaType.Boolean])(options);
  }

  static Date(options: Options<Date> = {}) {
    return this.propDecoratorFactory<Date>(MongooseSchemaType.Date)(options);
  }

  static DateArray(options: Options<Date[]> = {}) {
    return this.propDecoratorFactory<Date[]>([MongooseSchemaType.Date])(options);
  }

  static Map(options: Options<Map<any, any>> = {}) {
    return this.propDecoratorFactory<Map<any, any>>(MongooseSchemaType.Map)(options);
  }

  static MapArray(options: Options<Map<any, any>[]> = {}) {
    return this.propDecoratorFactory<Map<any, any>[]>([MongooseSchemaType.Map])(options);
  }

  static Buffer(options: Options<Types.Buffer> = {}) {
    return this.propDecoratorFactory<Types.Buffer>(MongooseSchemaType.Buffer)(options);
  }

  static BufferArray(options: Options<Types.Buffer[]> = {}) {
    return this.propDecoratorFactory<Types.Buffer[]>([MongooseSchemaType.Buffer])(options);
  }

  static Id(options: Options<Types.ObjectId> = {}) {
    return this.propDecoratorFactory<Types.ObjectId>(
      MongooseSchemaType.ObjectId,
      this.defaultObjectIdOptions,
    )(options);
  }

  static IdArray(options: Options<Types.ObjectId[]> = {}) {
    return this.propDecoratorFactory<Types.ObjectId[]>(
      [MongooseSchemaType.ObjectId],
      this.defaultObjectIdOptions,
    )(options);
  }

  static Uuid(options: Options<string> = {}) {
    return this.propDecoratorFactory<string>(MongooseSchemaType.UUID)(options);
  }

  static UuidArray(options: Options<string[]> = {}) {
    return this.propDecoratorFactory<string[]>([MongooseSchemaType.UUID])(options);
  }

  static Array(options: Options<any[]> = {}) {
    return this.propDecoratorFactory<any[]>(MongooseSchemaType.Array)(options);
  }

  static Mixed(options: Options<any> = {}) {
    return this.propDecoratorFactory<any>(MongooseSchemaType.Mixed)(options);
  }
}
