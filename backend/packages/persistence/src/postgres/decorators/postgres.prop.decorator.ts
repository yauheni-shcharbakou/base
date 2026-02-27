import { Dictionary, Enum, EnumOptions, Property, PropertyOptions } from '@mikro-orm/core';

type EnumOpts = EnumOptions<Dictionary> & { enum: Dictionary };

export class PostgresProp {
  static Date(options: PropertyOptions<Date> = {}) {
    return Property({ columnType: 'timestamptz', length: 3, ...options });
  }

  static Enum({ enum: dictionary, ...options }: EnumOpts) {
    return Enum({ columnType: 'varchar', items: () => dictionary, ...options });
  }
}
