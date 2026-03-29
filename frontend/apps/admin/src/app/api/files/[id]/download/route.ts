import { getErrorMessage, getRequestIp } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const ip = getRequestIp(request);

    if (ip) {
      authMeta.set('ip', ip);
    }

    const response = await fileGrpcRepository.getDownloadMap({ id, ids: [] }, authMeta);
    const downloadData = response.items.get(id);

    console.log('downloadData', downloadData);

    if (!downloadData) {
      throw new Error("Can't get download url for file");
    }

    const fileResponse = await fetch(downloadData.url);

    console.log(fileResponse);

    if (!fileResponse.ok) {
      return NextResponse.json(
        { message: 'Error during download file' },
        { status: fileResponse.status },
      );
    }

    if (!fileResponse.body) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const headers = new Headers();

    const contentType = fileResponse.headers.get('content-type');
    const contentLength = fileResponse.headers.get('content-length');

    headers.set('Content-Disposition', `attachment; filename="${downloadData.fileName}"`);
    headers.set('Content-Type', contentType || 'application/octet-stream');

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    console.log(fileResponse);

    return new NextResponse(fileResponse.body, { status: 200, headers });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
