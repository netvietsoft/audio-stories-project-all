import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveCountry } from './geo.util';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Record a per-(story,country,day,kind) activity bucket. Fire-and-forget: never throws, never blocks the host action. */
  async record(storyId: string, ip: string | undefined, kind: string, value = 1): Promise<void> {
    try {
      if (value <= 0) return;
      const country = resolveCountry(ip);
      if (!country) return;
      const day = new Date();
      day.setUTCHours(0, 0, 0, 0);
      await this.prisma.storyCountryDaily.upsert({
        where: { storyId_country_date_kind: { storyId, country, date: day, kind } },
        create: { storyId, country, date: day, kind, count: value },
        update: { count: { increment: value } },
      });
    } catch {
      /* geo is non-critical: swallow so the host action is unaffected */
    }
  }
}
