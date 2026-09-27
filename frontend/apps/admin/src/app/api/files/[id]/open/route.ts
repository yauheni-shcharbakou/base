import { getRequestIp } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { errorResponse } from '@/features/grpc/helpers/error-response';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const ip = getRequestIp(request);
    const query = request.nextUrl.searchParams;
    const response = await fileGrpcRepository.getUrlMap({ id, ids: [], ip }, authMeta);
    const url = response.entries.get(id);

    if (!url) {
      return NextResponse.json(
        { message: 'No URL for this file: it does not exist or has not finished uploading' },
        { status: 404 },
      );
    }

    const redirectUrl = new URL(url);

    if (query.size) {
      query.forEach((value, key) => {
        redirectUrl.searchParams.set(key, value);
      });
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return errorResponse(error);
  }
}
