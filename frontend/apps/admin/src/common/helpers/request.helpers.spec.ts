import { getHeadersIp } from './request.helpers';

describe('getHeadersIp', () => {
  it('reads the address from the trusted header', () => {
    const headers = new Headers({ 'x-real-ip': '203.0.113.7' });

    expect(getHeadersIp(headers, 'x-real-ip')).toBe('203.0.113.7');
  });

  it('ignores an address header the client can write', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '203.0.113.7' });

    expect(getHeadersIp(headers, 'x-real-ip')).toBe('203.0.113.7');
    expect(getHeadersIp(new Headers({ 'x-forwarded-for': '198.51.100.1' }), 'x-real-ip')).toBe(
      undefined,
    );
  });

  it('takes the last entry of a list, the one the nearest proxy added', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7' });

    expect(getHeadersIp(headers, 'x-forwarded-for')).toBe('203.0.113.7');
  });

  it('reads an IPv6 address', () => {
    const headers = new Headers({ 'x-real-ip': '2001:db8::1' });

    expect(getHeadersIp(headers, 'x-real-ip')).toBe('2001:db8::1');
  });

  it('answers nothing for a value that is not an address', () => {
    expect(getHeadersIp(new Headers({ 'x-real-ip': 'unknown' }), 'x-real-ip')).toBe(undefined);
    expect(getHeadersIp(new Headers({ 'x-real-ip': '' }), 'x-real-ip')).toBe(undefined);
    expect(getHeadersIp(new Headers(), 'x-real-ip')).toBe(undefined);
  });
});
