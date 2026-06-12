import { MongoEntity } from '../entities';
import _ from 'lodash';
import { Schema } from 'mongoose';

export function MongoIdPlugin(schema: Schema<MongoEntity>) {
  const toJsonOptions = schema.get('toJSON') || {};
  const toObjectOptions = schema.get('toObject') || {};

  const prevJsonTransform = toJsonOptions.transform;
  const prevObjectTransform = toObjectOptions.transform;

  const newJsonTransform = (doc: any, ret: any, options: any) => {
    if (_.isFunction(prevJsonTransform)) {
      ret = prevJsonTransform(doc, ret, options);
    }

    if (ret._id && _.isObject(ret._id)) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }

    return ret;
  };

  const newObjectTransform = (doc: any, ret: any, options: any) => {
    if (_.isFunction(prevObjectTransform)) {
      ret = prevObjectTransform(doc, ret, options);
    }

    if (ret._id && _.isObject(ret._id)) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }

    return ret;
  };

  schema.set('toJSON', {
    ...toJsonOptions,
    virtuals: true,
    transform: newJsonTransform,
  });

  schema.set('toObject', {
    ...toObjectOptions,
    virtuals: true,
    transform: newObjectTransform,
  });
}
