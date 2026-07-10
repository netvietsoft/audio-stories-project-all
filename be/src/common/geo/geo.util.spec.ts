import { clientIp, resolveCountry } from './geo.util';

jest.mock('geoip-lite', () => ({ lookup: jest.fn() }));
import * as geoip from 'geoip-lite';

describe('clientIp', () => {
  it('takes first x-forwarded-for entry', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } } as any)).toBe('1.2.3.4');
  });
  it('falls back to socket.remoteAddress', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '5.6.7.8' } } as any)).toBe('5.6.7.8');
  });
  it('undefined when none', () => {
    expect(clientIp({ headers: {} } as any)).toBeUndefined();
  });
});

describe('resolveCountry', () => {
  it('null for missing / localhost / private', () => {
    expect(resolveCountry(undefined)).toBeNull();
    expect(resolveCountry('127.0.0.1')).toBeNull();
    expect(resolveCountry('192.168.1.9')).toBeNull();
    expect(resolveCountry('10.0.0.5')).toBeNull();
  });
  it('null for private 172.16.0.0/12 range', () => {
    expect(resolveCountry('172.16.0.1')).toBeNull();
    expect(resolveCountry('172.20.5.5')).toBeNull();
  });
  it('resolves public IPs outside the 172.16-31 private range', () => {
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'US' });
    expect(resolveCountry('172.5.0.1')).toBe('US');
    expect(resolveCountry('172.40.0.1')).toBe('US');
  });
  it('returns upper 2-letter code from geoip', () => {
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'vn' });
    expect(resolveCountry('8.8.8.8')).toBe('VN');
  });
  it('null when geoip has no match', () => {
    (geoip.lookup as jest.Mock).mockReturnValue(null);
    expect(resolveCountry('8.8.8.8')).toBeNull();
  });
  it('strips ::ffff: prefix from IPv4-mapped addresses before lookup', () => {
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'vn' });
    expect(resolveCountry('::ffff:8.8.8.8')).toBe('VN');
    expect(geoip.lookup).toHaveBeenCalledWith('8.8.8.8');
  });
});
