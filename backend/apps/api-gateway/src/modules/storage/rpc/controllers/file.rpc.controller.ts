// import {
//   GrpcBaseQuery,
//   GrpcFile,
//   GrpcFileCreate,
//   GrpcFileGetListResponse,
//   GrpcFileProxyService,
//   GrpcFileProxyServiceController,
//   GrpcFileService,
//   GrpcFileServiceClient,
//   GrpcFileSignedUrls,
//   GrpcFileUploadRequest,
//   GrpcGetListRequest,
//   GrpcIdField,
// } from '@backend/grpc';
// import {
//   GrpcProxyStreamMethod,
//   GrpcRxPipe,
//   InjectGrpcService,
//   ValidateGrpcPayload,
// } from '@backend/transport';
// import { Metadata } from '@grpc/grpc-js';
// import { Inject } from '@nestjs/common';
// import { AdminGrpcController } from 'common/decorators/access.decorator';
// import { BaseQueryDto } from 'common/dto/base-query.dto';
// import { GetListRequestDto } from 'common/dto/get-list-request.dto';
// import { IdFieldDto } from 'common/dto/id-field.dto';
// import { FileCreateDto } from 'common/dto/services/file.service.dto';
// import { STORAGE_SERVICE, StorageService } from 'modules/storage/service/storage.service';
// import { Observable } from 'rxjs';
//
// @AdminGrpcController()
// @GrpcFileProxyService.ControllerMethods()
// export class FileRpcController implements GrpcFileProxyServiceController {
//   constructor(
//     @InjectGrpcService(GrpcFileService.name)
//     private readonly fileServiceClient: GrpcFileServiceClient,
//     @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
//   ) {}
//
//   @ValidateGrpcPayload(BaseQueryDto)
//   getSignedUrls(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcFileSignedUrls> {
//     return this.fileServiceClient
//       .getSignedUrls(request, metadata?.clone())
//       .pipe(GrpcRxPipe.rpcException);
//   }
//
//   @ValidateGrpcPayload(IdFieldDto)
//   getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
//     return this.fileServiceClient.getById(request, metadata?.clone()).pipe(GrpcRxPipe.rpcException);
//   }
//
//   @ValidateGrpcPayload(GetListRequestDto)
//   getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
//     return this.fileServiceClient.getList(request, metadata?.clone()).pipe(GrpcRxPipe.rpcException);
//   }
//
//   @ValidateGrpcPayload(FileCreateDto)
//   createOne(
//     request: GrpcFileCreate,
//     metadata?: Metadata,
//   ): Promise<GrpcFile> | Observable<GrpcFile> | GrpcFile {
//     return this.fileServiceClient
//       .createOne(request, metadata?.clone())
//       .pipe(GrpcRxPipe.rpcException);
//   }
//
//   @GrpcProxyStreamMethod()
//   uploadOne(request: Observable<GrpcFileUploadRequest>, metadata?: Metadata): Observable<GrpcFile> {
//     return this.storageService.uploadFile(request, metadata).pipe(GrpcRxPipe.unwrapEither);
//   }
//
//   @ValidateGrpcPayload(IdFieldDto)
//   deleteById(
//     request: GrpcIdField,
//     metadata?: Metadata,
//   ): Promise<GrpcFile> | Observable<GrpcFile> | GrpcFile {
//     return this.fileServiceClient
//       .deleteById(request, metadata?.clone())
//       .pipe(GrpcRxPipe.rpcException);
//   }
// }
