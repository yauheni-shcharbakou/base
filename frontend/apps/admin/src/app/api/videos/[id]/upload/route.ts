import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { handleStreamFileUpload } from '@/features/storage/route-handlers';
import { videoGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!req.body) {
    return NextResponse.json({ message: 'Body is required' }, { status: 400 });
  }

  try {
    const authMetadata = await authService.getStreamAuthMetadata();
    const id = (await params).id;

    return handleStreamFileUpload(
      req,
      id,
      () => videoGrpcRepository.getClient().uploadOne(authMetadata),
      600,
    );
  } catch (err) {
    return NextResponse.json({ message: getErrorMessage(err) }, { status: 500 });
  }
}
