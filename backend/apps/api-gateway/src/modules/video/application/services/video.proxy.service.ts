import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import {
  GrpcVideoServiceClient,
  GrpcVideoTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { VideoMapper } from '../mappers/video.mapper';

@Injectable()
export class VideoProxyService {
  constructor(
    @InjectGrpcService(GrpcVideoTransport.service)
    private readonly videoClient: GrpcVideoServiceClient,
    private readonly videoMapper: VideoMapper,
  ) {}

  getUrlMap(query: NestCommon.Query, userId?: string): Promise<NestCommon.StringMap> {
    return firstValueFrom(
      this.videoClient.getUrlMap({ ...query, userId }).pipe(GrpcRxPipe.rpcException),
    );
  }

  getDownloadMap(query: NestCommon.Query, userId?: string): Promise<NestStorage.DownloadMap> {
    return firstValueFrom(
      this.videoClient.getDownloadMap({ ...query, userId }).pipe(GrpcRxPipe.rpcException),
    );
  }

  getOne(query: Partial<NestStorage.VideoQuery>): Promise<NestStorage.VideoPopulated> {
    const requestQuery: NestStorage.VideoQuery = this.videoMapper.transformQuery(query);
    return firstValueFrom(this.videoClient.getOne(requestQuery).pipe(GrpcRxPipe.rpcException));
  }

  getList(request: NestCommon.GetList): Promise<NestStorage.VideoList> {
    return firstValueFrom(this.videoClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  createOne(request: NestStorage.VideoCreateOne): Promise<NestStorage.VideoCreated> {
    return firstValueFrom(this.videoClient.createOne(request).pipe(GrpcRxPipe.rpcException));
  }

  createMany(request: NestStorage.VideoCreateMany): Promise<NestStorage.VideoCreatedArray> {
    return firstValueFrom(this.videoClient.createMany(request).pipe(GrpcRxPipe.rpcException));
  }

  updateOne(
    query: Partial<NestStorage.VideoQuery>,
    update: NestStorage.VideoUpdate,
  ): Promise<NestStorage.Video> {
    const requestQuery: NestStorage.VideoQuery = this.videoMapper.transformQuery(query);

    return firstValueFrom(
      this.videoClient.updateOne({ query: requestQuery, update }).pipe(GrpcRxPipe.rpcException),
    );
  }

  deleteOne(query: Partial<NestStorage.VideoQuery>): Promise<NestStorage.Video> {
    const requestQuery: NestStorage.VideoQuery = this.videoMapper.transformQuery(query);
    return firstValueFrom(this.videoClient.deleteOne(requestQuery).pipe(GrpcRxPipe.rpcException));
  }
}
