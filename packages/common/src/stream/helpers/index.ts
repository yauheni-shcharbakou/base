import { ClientWritableStream } from '@grpc/grpc-js';
import type { Writable } from 'node:stream';

export const sendToWritable = <Data = any>(stream$: Writable, data: Data) => {
  return new Promise<void>((resolve, reject) => {
    const canWrite = stream$.write(data);

    if (canWrite) {
      return resolve();
    }

    const cleanup = () => {
      stream$.removeListener('drain', onDrain);
      stream$.removeListener('error', onError);
    };

    function onDrain() {
      cleanup();
      resolve();
    }

    function onError(err: Error) {
      cleanup();
      reject(err);
    }

    stream$.once('drain', onDrain);
    stream$.once('error', onError);
  });
};

export const sendToGrpcStream = <Data>(stream$: ClientWritableStream<Data>, data: Data) => {
  return sendToWritable<Data>(stream$, data);
};
