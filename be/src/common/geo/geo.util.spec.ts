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
  it('returns upper 2-letter code from geoip', () => {
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'vn' });
    expect(resolveCountry('8.8.8.8')).toBe('VN');
  });
  it('null when geoip has no match', () => {
    (geoip.lookup as jest.Mock).mockReturnValue(null);
    expect(resolveCountry('8.8.8.8')).toBeNull();
  });
});
