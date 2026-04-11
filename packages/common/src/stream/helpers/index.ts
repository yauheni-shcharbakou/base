import { ClientWritableStream } from '@grpc/grpc-js';
import { Writable } from 'node:stream';

export const sendToWritable = <Data = any>(stream$: Writable, data: Data) => {
  return new Promise<void>((resolve, reject) => {
    const canWrite = stream$.write(data);

    if (canWrite) {
      resolve();
    } else {
      stream$.once('drain', resolve);
      stream$.once('error', reject);
    }
  });
};

export const sendToGrpcStream = <Data>(stream$: ClientWritableStream<Data>, data: Data) => {
  return sendToWritable<Data>(stream$, data);
};
