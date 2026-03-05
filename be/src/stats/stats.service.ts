import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
    constructor(private readonly prisma: PrismaService) { }

    async getOverviewStats() {
        const [totalUsers, totalStories, revenueAggregate] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.story.count(),
            this.prisma.payment.aggregate({
                _sum: {
                    amountVnd: true,
                },
                where: {
                    status: 'SUCCESS',
                },
            }),
        ]);

        return {
            totalUsers,
            totalStories,
            totalRevenue: revenueAggregate._sum.amountVnd || 0,
        };
    }
}
