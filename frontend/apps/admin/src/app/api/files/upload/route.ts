import { fileGrpcClient } from '@/grpc/clients';
import { getErrorMessage } from '@/helpers/error.helpers';
import { authService, configService } from '@/services';
import { GrpcFile, GrpcFileUploadResponse } from '@frontend/grpc';
import { sendToGrpcStream } from '@packages/common';
import { NextResponse } from 'next/server';
import Busboy from 'busboy';
import { Readable } from 'node:stream';

type ResponseEvent =
  | {
      type: 'percent';
      value: number;
    }
  | {
      type: 'entity';
      value: GrpcFile;
    };

export async function POST(req: Request): Promise<Response> {
  try {
    const authMetadata = await authService.getAuthMetadata();
    const chunkSize = configService.getChunkSize();

    const response$ = new TransformStream();
    const writer = response$.writable.getWriter();
    const encoder = new TextEncoder();

    const busboy$ = Busboy({
      headers: {
        'content-type': req.headers.get('content-type')!,
      },
    });

    const request$ = fileGrpcClient.uploadOne(authMetadata);

    request$.on('data', (response: GrpcFileUploadResponse) => {
      if (response.percent) {
        const res: ResponseEvent = { type: 'percent', value: response.percent };
        writer.write(encoder.encode(JSON.stringify(res) + '\n'));
        return;
      }

      if (response.file) {
        const res: ResponseEvent = { type: 'entity', value: response.file };
        writer.write(encoder.encode(JSON.stringify(res) + '\n'));
      }
    });

    request$.on('error', (err) => {
      busboy$.removeAllListeners('field');
      busboy$.removeAllListeners('file');

      if (!busboy$.destroyed) {
        busboy$.on('error', () => {});
        busboy$.destroy();
      }

      console.log(err);
      writer.abort(err).catch(() => {});
    });

    request$.on('end', () => {
      writer.close().catch(() => {});
    });

    const createData: Record<string, string> = {};

    busboy$.on('field', (field: string, value: string) => {
      createData[field] = value;
    });

    busboy$.on('file', async (name, file$) => {
      request$.write({
        create: {
          name: createData['name'] || createData['file.originalName'],
          originalName: createData['file.originalName'],
          size: +(createData['file.size'] || 0),
          mimeType: createData['file.mimeType'],
          isPublic: createData['isPublic'] === 'true',
        },
      });

      for await (const chunk of file$) {
        const data = new Uint8Array(chunk);

        for (let i = 0; i < data.length; i += chunkSize) {
          const subChunk = data.slice(i, i + chunkSize);
          await sendToGrpcStream(request$, { chunk: subChunk });
        }
      }
    });

    busboy$.on('finish', () => {
      request$.end();
    });

    if (req.body) {
      Readable.fromWeb(req.body as any).pipe(busboy$);
    }

    return new Response(response$.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return NextResponse.json({ message: getErrorMessage(err) }, { status: 500 });
  }
}
