import { authService, configService } from '@/services';
import { GrpcFileServiceClient, GrpcFileCreate } from '@frontend/grpc';
import { ChannelCredentials } from '@grpc/grpc-js';
import { sendToGrpcStream } from '@packages/common';
import { NextResponse } from 'next/server';

const fileGrpcClient = new GrpcFileServiceClient(
  configService.getGrpcUrl(),
  ChannelCredentials.createInsecure(),
  {},
);

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authMetadata = await authService.getAuthMetadata();
    const chunkSize = configService.getChunkSize();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const isPublic = formData.get('isPublic') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    return new Promise<NextResponse>((resolve) => {
      const grpcStream = fileGrpcClient.uploadOne(authMetadata, (error, response) => {
        if (error) {
          resolve(NextResponse.json({ message: error.details }, { status: 500 }));
        } else {
          resolve(NextResponse.json(response));
        }
      });

      const createData: GrpcFileCreate = {
        name: name || file.name,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        isPublic: isPublic === 'true',
      };

      grpcStream.write({ create: createData });

      const reader = file.stream().getReader();

      async function streamChunks() {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            await sendToGrpcStream(grpcStream, { isFinished: true });
            grpcStream.end();
            break;
          }

          for (let i = 0; i < value.length; i += chunkSize) {
            const subChunk = value.slice(i, i + chunkSize);
            await sendToGrpcStream(grpcStream, { chunk: subChunk });
          }
        }
      }

      streamChunks().catch((err) => {
        grpcStream.cancel();
        resolve(NextResponse.json({ message: 'Stream failed' }, { status: 500 }));
      });
    });
  } catch (err) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
}
