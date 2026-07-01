import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import {
  GrpcImageServiceClient,
  GrpcImageTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ImageMapper } from '../mappers/image.mapper';

@Injectable()
export class ImageProxyService {
  constructor(
    @InjectGrpcService(GrpcImageTransport.service)
    private readonly imageClient: GrpcImageServiceClient,
    private readonly imageMapper: ImageMapper,
  ) {}

  getById(id: string): Promise<NestStorage.ImagePopulated> {
    return firstValueFrom(this.imageClient.getById({ id }).pipe(GrpcRxPipe.rpcException));
  }

  getList(request: NestCommon.GetList): Promise<NestStorage.ImageList> {
    return firstValueFrom(this.imageClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  createOne(request: NestStorage.ImageCreateOne): Promise<NestStorage.Image> {
    return firstValueFrom(this.imageClient.createOne(request).pipe(GrpcRxPipe.rpcException));
  }

  createMany(request: NestStorage.ImageCreateMany): Promise<NestStorage.ImageArray> {
    return firstValueFrom(this.imageClient.createMany(request).pipe(GrpcRxPipe.rpcException));
  }

  updateOne(
    query: Partial<NestStorage.ImageQuery>,
    update: NestStorage.ImageUpdate,
  ): Promise<NestStorage.Image> {
    const transformedQuery: NestStorage.ImageQuery = this.imageMapper.transformQuery(query);

    return firstValueFrom(
      this.imageClient.updateOne({ query: transformedQuery, update }).pipe(GrpcRxPipe.rpcException),
    );
  }

  deleteOne(query: Partial<NestStorage.ImageQuery>): Promise<NestStorage.Image> {
    const transformedQuery: NestStorage.ImageQuery = this.imageMapper.transformQuery(query);

    return firstValueFrom(
      this.imageClient.deleteOne(transformedQuery).pipe(GrpcRxPipe.rpcException),
    );
  }
}
