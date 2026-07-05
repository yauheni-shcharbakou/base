import { NestCommon } from '@backend/proto';

export abstract class QueryMapper<Query extends NestCommon.Query> {
  protected getBaseQuery(): Query {
    return { ids: [] } as Query;
  }

  transformQuery(query: Partial<Query>): Query {
    return { ...this.getBaseQuery(), ...query };
  }
}
