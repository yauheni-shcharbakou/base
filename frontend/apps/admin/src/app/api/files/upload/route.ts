import { configService } from '@/common/services';
import { authService } from '@/features/auth/services';
import { grpcDataService } from '@/features/grpc/services';
import { GrpcFileUploadRequest } from '@backend/grpc';
import { ClientWritableStream } from '@grpc/grpc-js';
import { FileDatabaseEntity } from '@packages/common';
import { NextResponse } from 'next/server';
import Busboy from 'busboy';
import { Readable } from 'node:stream';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authMetadata = await authService.getAuthMetadata();
    const chunkSize = configService.getChunkSize();

    const headers = Object.fromEntries(req.headers.entries());
    const reqBody$ = Readable.fromWeb(req.body as any);

    return new Promise<NextResponse>((resolve) => {
      const busboy$ = Busboy({ headers });

      let request$: ClientWritableStream<GrpcFileUploadRequest>;
      let fileProcessed = false;
      const createData: Record<string, string> = {};

      busboy$.on('field', (name, val) => {
        createData[name] = val;
      });

      busboy$.on('file', async (_name, file$, _info) => {
        fileProcessed = true;

        request$ = grpcDataService
          .getClient(FileDatabaseEntity.FILE)
          .uploadOne(authMetadata, (error, response) => {
            if (error) {
              reqBody$.unpipe(busboy$);
              reqBody$.destroy();
              busboy$.removeAllListeners();

              resolve(NextResponse.json({ message: error.details }, { status: 500 }));
            } else {
              resolve(NextResponse.json(response));
            }
          });

        request$.write({
          create: {
            name: createData['name'] || createData['file.originalName'],
            originalName: createData['file.originalName'],
            size: +(createData['file.size'] || 0),
            mimeType: createData['file.mimeType'],
            isPublic: createData['isPublic'] === 'true',
          },
        });

        file$.on('data', async (chunk: Buffer) => {
          const data = new Uint8Array(chunk);

          for (let i = 0; i < data.length; i += chunkSize) {
            const subChunk = data.slice(i, i + chunkSize);

            if (!request$.write({ chunk: subChunk })) {
              file$.pause();
              request$.once('drain', () => file$.resume());
            }
          }
        });

        file$.on('end', () => {
          request$.end();
        });

        file$.on('error', (err) => {
          request$.cancel();
          resolve(NextResponse.json({ message: 'File stream error' }, { status: 500 }));
        });
      });

      busboy$.on('error', (err) => {
        resolve(NextResponse.json({ message: 'Parse error' }, { status: 500 }));
      });

      busboy$.on('finish', () => {
        if (!fileProcessed) {
          resolve(NextResponse.json({ error: 'No file provided' }, { status: 400 }));
        }
      });

      reqBody$.pipe(busboy$);
    });
  } catch (err) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
}
