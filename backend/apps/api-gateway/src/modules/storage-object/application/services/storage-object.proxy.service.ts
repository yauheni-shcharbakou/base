import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import {
  GrpcStorageObjectServiceClient,
  GrpcStorageObjectTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { StorageObjectMapper } from '../mappers/storage-object.mapper';

@Injectable()
export class StorageObjectProxyService {
  constructor(
    @InjectGrpcService(GrpcStorageObjectTransport.service)
    private readonly storageObjectClient: GrpcStorageObjectServiceClient,
    private readonly storageObjectMapper: StorageObjectMapper,
  ) {}

  getById(id: string): Promise<NestStorage.StorageObjectPopulated> {
    return firstValueFrom(this.storageObjectClient.getById({ id }).pipe(GrpcRxPipe.rpcException));
  }

  getMany(query: Partial<NestStorage.StorageObjectQuery>): Promise<NestStorage.StorageObjectArray> {
    const transformedQuery: NestStorage.StorageObjectQuery =
      this.storageObjectMapper.transformQuery(query);

    return firstValueFrom(
      this.storageObjectClient.getMany(transformedQuery).pipe(GrpcRxPipe.rpcException),
    );
  }

  getFolders(
    request: NestStorage.StorageObjectGetFolders,
  ): Promise<NestStorage.StorageObjectArray> {
    return firstValueFrom(
      this.storageObjectClient.getFolders(request).pipe(GrpcRxPipe.rpcException),
    );
  }

  getList(request: NestCommon.GetList): Promise<NestStorage.StorageObjectList> {
    return firstValueFrom(this.storageObjectClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  isExists(query: Partial<NestStorage.StorageObjectQuery>): Promise<NestCommon.Boolean> {
    const transformedQuery: NestStorage.StorageObjectQuery =
      this.storageObjectMapper.transformQuery(query);

    return firstValueFrom(
      this.storageObjectClient.isExists(transformedQuery).pipe(GrpcRxPipe.rpcException),
    );
  }

  createOne(request: NestStorage.StorageObjectCreate): Promise<NestStorage.StorageObject> {
    return firstValueFrom(
      this.storageObjectClient.createOne(request).pipe(GrpcRxPipe.rpcException),
    );
  }

  updateOne(
    query: Partial<NestStorage.StorageObjectQuery>,
    update: NestStorage.StorageObjectUpdate,
  ): Promise<NestStorage.StorageObject> {
    const transformedQuery: NestStorage.StorageObjectQuery =
      this.storageObjectMapper.transformQuery(query);

    return firstValueFrom(
      this.storageObjectClient
        .updateOne({ query: transformedQuery, update })
        .pipe(GrpcRxPipe.rpcException),
    );
  }

  deleteOne(query: Partial<NestStorage.StorageObjectQuery>): Promise<NestStorage.StorageObject> {
    const transformedQuery: NestStorage.StorageObjectQuery =
      this.storageObjectMapper.transformQuery(query);

    return firstValueFrom(
      this.storageObjectClient.deleteOne(transformedQuery).pipe(GrpcRxPipe.rpcException),
    );
  }
}
