import { InjectGrpcService } from '@backend/grpc';
import { GrpcUserServiceClient, GrpcUserTransport } from '@backend/proto';
import { UserDirectoryService } from '@modules/user/domain/services/user-directory.service';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GrpcUserDirectoryServiceImpl extends UserDirectoryService {
  constructor(
    @InjectGrpcService(GrpcUserTransport.service)
    private readonly userServiceClient: GrpcUserServiceClient,
  ) {
    super();
  }

  async count(): Promise<Either<Error, number>> {
    try {
      const page = await firstValueFrom(
        this.userServiceClient.getList({
          logicalFilters: [],
          conditionalFilters: [],
          sorters: [],
          pagination: { page: 1, limit: 1 },
        }),
      );

      return right(page.total);
    } catch (error) {
      return left(error);
    }
  }

  // Never called with no ids: an empty `ids` filter matches every user.
  async getExistingIds(ids: string[]): Promise<Either<Error, Set<string>>> {
    if (!ids.length) {
      return right(new Set());
    }

    try {
      const users = await firstValueFrom(this.userServiceClient.getMany({ ids, roles: [] }));
      return right(new Set(_.map(users.items, 'id')));
    } catch (error) {
      return left(error);
    }
  }
}
