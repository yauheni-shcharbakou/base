import { MongoEntity } from 'entities';
import _ from 'lodash';
import { Schema } from 'mongoose';

export function MongoIdPlugin(schema: Schema<MongoEntity>) {
  // Получаем текущие настройки (если они уже были заданы в @Schema)
  const toJsonOptions = schema.get('toJSON') || {};
  const toObjectOptions = schema.get('toJSON') || {};

  const prevJsonTransform = toJsonOptions.transform;
  const prevObjectTransform = toObjectOptions.transform;

  const newJsonTransform = (doc: any, ret: any, options: any) => {
    // 1. Сначала запускаем существующий пользовательский transform (если есть)
    if (_.isFunction(prevJsonTransform)) {
      ret = prevJsonTransform(doc, ret, options);
    }

    // 2. Теперь применяем нашу глобальную логику
    if (ret._id && _.isObject(ret._id)) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }

    return ret;
  };

  const newObjectTransform = (doc: any, ret: any, options: any) => {
    // 1. Сначала запускаем существующий пользовательский transform (если есть)
    if (_.isFunction(prevObjectTransform)) {
      ret = prevObjectTransform(doc, ret, options);
    }

    // 2. Теперь применяем нашу глобальную логику
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
