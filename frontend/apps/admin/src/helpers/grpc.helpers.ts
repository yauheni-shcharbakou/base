import { ClientWritableStream } from '@grpc/grpc-js';

export const sendToGrpcStream = async <Data>(stream$: ClientWritableStream<Data>, data: Data) => {
  const pushResult = stream$.write(data);

  if (!pushResult) {
    await new Promise((resolve) => stream$.once('drain', resolve));
  }
};
