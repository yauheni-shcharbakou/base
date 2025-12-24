import { Schema, SchemaOptions } from '@nestjs/mongoose';

export const MongoSchema = (options: SchemaOptions = {}): ClassDecorator => {
  return Schema({
    timestamps: true,
    // toObject: {
    //   transform: (doc, ret, options) => {
    //     console.log('toObject', doc, ret, options);
    //     return ret;
    //   },
    // },
    // toJSON: {
    //   transform: (doc, ret, options) => {
    //     console.log('toJSON', doc, ret, options);
    //     return doc;
    //   },
    // },
    ...options,
  });
};
