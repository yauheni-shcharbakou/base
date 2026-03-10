import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const query = request.nextUrl.searchParams;

    const response = await fileGrpcRepository.getUrlMap({ id, ids: [] }, authMeta);
    const url = response.items.get(id);

    if (!url) {
      throw new Error("Can't get signed url for file");
    }

    const redirectUrl = new URL(url);

    if (query.size) {
      query.entries().forEach(([key, value]) => {
        redirectUrl.searchParams.set(key, value);
      });
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
