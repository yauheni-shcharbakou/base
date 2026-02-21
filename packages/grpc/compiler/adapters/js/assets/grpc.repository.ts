import { CallOptions, Client, ClientUnaryCall, Metadata, ServiceError } from '@grpc/grpc-js';

type GrpcRequestCallback<Req = any, Res = any> = (
  request: Req,
  metadata: Metadata,
  options: Partial<CallOptions>,
  callback: (error: ServiceError | null, response: Res) => void,
) => ClientUnaryCall;

export abstract class GrpcRepository<GrpcClient extends Client> {
  constructor(protected readonly client: GrpcClient) {}

  protected call<Req = any, Res = any>(method: GrpcRequestCallback<Req, Res>) {
    return (
      req: Req,
      metadata: Metadata = new Metadata(),
      options: Partial<CallOptions> = {},
    ): Promise<Res> => {
      return new Promise<Res>((resolve, reject) => {
        method.call(this.client, req, metadata, options, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        });
      });
    };
  }

  protected exec<Req = any, Res = any>(
    method: string,
    req: Req,
    metadata: Metadata = new Metadata(),
    options: Partial<CallOptions> = {},
  ): Promise<Res> {
    return new Promise<Res>((resolve, reject) => {
      // @ts-ignore
      const clientMethod = this.client[method] as unknown as GrpcRequestCallback<Req, Res>;

      clientMethod.call(this.client, req, metadata, options, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }
}
