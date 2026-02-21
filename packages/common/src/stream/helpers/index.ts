import { ClientWritableStream } from '@grpc/grpc-js';
import { Writable } from 'node:stream';

export const sendToWritable = async <Data = any>(stream$: Writable, data: Data) => {
  const pushResult = stream$.write(data);

  if (!pushResult) {
    await new Promise((resolve) => stream$.once('drain', resolve));
  }
};

export const sendToGrpcStream = async <Data>(stream$: ClientWritableStream<Data>, data: Data) => {
  await sendToWritable<Data>(stream$, data);
};
