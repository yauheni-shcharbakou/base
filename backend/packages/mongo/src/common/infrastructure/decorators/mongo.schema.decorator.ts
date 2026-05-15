import { Schema, SchemaOptions } from '@nestjs/mongoose';

type Options = Omit<SchemaOptions, 'collection'> & {
  collection: string;
};

export const MongoSchema = (options: Options): ClassDecorator => {
  return Schema({
    timestamps: true,
    virtuals: true,
    ...options,
  });
};
