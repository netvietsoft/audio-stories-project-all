import * as geoip from 'geoip-lite';

export function clientIp(req: { headers: Record<string, any>; socket?: { remoteAddress?: string } }): string | undefined {
  const raw = (req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress;
  return raw ? String(raw).split(',')[0].trim() : undefined;
}

export function resolveCountry(ip?: string): string | null {
  if (!ip) return null;
  let addr = ip;
  if (addr.startsWith('::ffff:')) addr = addr.slice(7);
  const isLocalhost = addr === '127.0.0.1' || addr === '::1' || addr === 'localhost';
  const isPrivate = addr.startsWith('192.168.') || addr.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(addr);
  if (isLocalhost || isPrivate) return null;
  const geo = geoip.lookup(addr);
  return geo?.country ? geo.country.toUpperCase() : null;
}
