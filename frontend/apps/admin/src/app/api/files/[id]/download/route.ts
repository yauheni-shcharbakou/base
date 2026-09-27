import { getServerPublicIp } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { errorResponse } from '@/features/grpc/helpers/error-response';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const ip = await getServerPublicIp();
    const response = await fileGrpcRepository.getDownloadMap({ id, ids: [], ip }, authMeta);
    const downloadData = response.entries.get(id);

    if (!downloadData) {
      return NextResponse.json(
        {
          message: 'No download URL for this file: it does not exist or has not finished uploading',
        },
        { status: 404 },
      );
    }

    const fileResponse = await fetch(downloadData.url, { headers: request.headers });

    if (!fileResponse.ok) {
      return NextResponse.json(
        { message: 'Error during download file' },
        { status: fileResponse.status },
      );
    }

    if (!fileResponse.body) {
      return NextResponse.json({ message: 'Empty file' }, { status: 502 });
    }

    const headers = new Headers();

    const contentType = fileResponse.headers.get('content-type');
    const contentLength = fileResponse.headers.get('content-length');

    headers.set('Content-Disposition', `attachment; filename="${downloadData.fileName}"`);
    headers.set('Content-Type', contentType || 'application/octet-stream');

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(fileResponse.body, { status: 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
