import { type NextRequest } from 'next/server';

export const getRequestIp = (req: NextRequest): string | undefined => getHeadersIp(req.headers);

export const getHeadersIp = (headers: Pick<Headers, 'get'>): string | undefined => {
  const forwardedFor = headers.get('x-forwarded-for') || headers.get('X-Forwarded-For');

  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0]?.trim();

    if (clientIp) {
      return clientIp;
    }
  }

  const realIp = headers.get('x-real-ip') || headers.get('X-Real-IP');

  if (realIp) {
    const clientIp = realIp.split(',')[0]?.trim();

    if (clientIp) {
      return clientIp;
    }
  }
};

export const getServerPublicIp = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return null;
  }
};
