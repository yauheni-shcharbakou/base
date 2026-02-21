import { Type } from '@nestjs/common';
import { ModelDefinition, SchemaFactory } from '@nestjs/mongoose';
import _ from 'lodash';
import { MongoEntity } from 'mongo/entities';

export const convertEntitiesToMongoDefinitions = (
  entities: Type<MongoEntity>[] = [],
): ModelDefinition[] => {
  return _.map(entities, (Entity) => {
    const schema = SchemaFactory.createForClass(Entity);
    const collection = schema.options.collection;

    if (!collection) {
      throw new Error(`No collection found for entity ${Entity.name}`);
    }

    return {
      schema,
      name: collection,
    };
  });
};
