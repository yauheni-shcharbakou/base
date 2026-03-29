import { type NextRequest } from 'next/server';

export const getRequestIp = (req: NextRequest): string | undefined => {
  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('X-Forwarded-For');

  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0]?.trim();

    if (clientIp) {
      return clientIp;
    }
  }

  const realIp = req.headers.get('x-real-ip') || req.headers.get('X-Real-IP');

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
