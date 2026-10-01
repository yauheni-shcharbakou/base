export const decodeBase64Pem = (value: string): string => {
  return Buffer.from(value, 'base64').toString('utf8');
};
