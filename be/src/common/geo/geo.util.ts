import * as geoip from 'geoip-lite';

export function clientIp(req: { headers: Record<string, any>; socket?: { remoteAddress?: string } }): string | undefined {
  const raw = (req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress;
  return raw ? String(raw).split(',')[0].trim() : undefined;
}

export function resolveCountry(ip?: string): string | null {
  if (!ip) return null;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  const isPrivate = ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
  if (isLocalhost || isPrivate) return null;
  const geo = geoip.lookup(ip);
  return geo?.country ? geo.country.toUpperCase() : null;
}
