import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { MembershipQueryDto } from './dto/membership-query.dto';
import { Prisma } from '@prisma/client';
import { MailService } from '@/mail/mail.service';

@Injectable()
export class MembershipsService {
    private readonly logger = new Logger(MembershipsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    private resolveReminderHour(diffHours: number) {
        if (diffHours <= 24) return 24;
        if (diffHours <= 48) return 48;
        if (diffHours <= 72) return 72;
        return null;
    }

    async findAll(query: MembershipQueryDto) {
        const { page = 1, limit = 20, search, type, status } = query;
        const skip = (page - 1) * limit;
        const now = new Date();

        const where: Prisma.MembershipWhereInput = {
            ...(type ? { type } : {}),
            ...(status === 'active' ? { endDate: { gte: now } } : {}),
            ...(status === 'expired' ? { endDate: { lt: now } } : {}),
            ...(search
                ? {
                    OR: [
                        { user: { email: { contains: search } } },
                        { user: { displayName: { contains: search } } },
                        { author: { name: { contains: search } } },
                    ],
                }
                : {}),
        };

        const [memberships, total] = await Promise.all([
            this.prisma.membership.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            displayName: true,
                            vipTier: true,
                        },
                    },
                    author: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            this.prisma.membership.count({ where }),
        ]);

        return {
            data: memberships,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getStats() {
        const now = new Date();

        const [
            totalMemberships,
            activeMemberships,
            expiredMemberships,
            allAuthorsCount,
            specificAuthorCount,
        ] = await Promise.all([
            this.prisma.membership.count(),
            this.prisma.membership.count({
                where: { endDate: { gte: now } },
            }),
            this.prisma.membership.count({
                where: { endDate: { lt: now } },
            }),
            this.prisma.membership.count({
                where: { type: 'all_authors' },
            }),
            this.prisma.membership.count({
                where: { type: 'specific_author' },
            }),
        ]);

        return {
            totalMemberships,
            activeMemberships,
            expiredMemberships,
            allAuthorsCount,
            specificAuthorCount,
        };
    }

    async remove(id: string) {
        const membership = await this.prisma.membership.findUnique({
            where: { id },
        });

        if (!membership) {
            throw new NotFoundException(`Membership with ID ${id} not found`);
        }

        return this.prisma.membership.delete({
            where: { id },
        });
    }

    @Cron(CronExpression.EVERY_HOUR)
    async sendMembershipExpiryReminders() {
        const now = new Date();
        const threshold = new Date(now.getTime() + 72 * 60 * 60 * 1000);

        const rows = await this.prisma.membership.findMany({
            where: {
                endDate: {
                    gt: now,
                    lte: threshold,
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        allowBellNoti: true,
                        allowEmailNoti: true,
                    },
                },
            },
            take: 500,
        });

        for (const membership of rows) {
            const diffHours = Math.ceil((membership.endDate.getTime() - now.getTime()) / (60 * 60 * 1000));
            const reminderHour = this.resolveReminderHour(diffHours);
            if (!reminderHour) continue;

            const title = `Hoi vien sap het han trong ${reminderHour} gio`;
            const existed = await this.prisma.notification.findFirst({
                where: {
                    userId: membership.userId,
                    type: 'membership_expiry',
                    title,
                    createdAt: {
                        gte: new Date(now.getTime() - 23 * 60 * 60 * 1000),
                    },
                },
                select: { id: true },
            });

            if (existed) continue;

            if (membership.user.allowBellNoti) {
                await this.prisma.notification.create({
                    data: {
                        userId: membership.userId,
                        type: 'membership_expiry',
                        title,
                        body: `Goi hoi vien cua ban se het han luc ${membership.endDate.toLocaleString('vi-VN')}.`,
                        metadata: {
                            membershipId: membership.id,
                            endDate: membership.endDate.toISOString(),
                            reminderHour,
                        },
                    },
                });
            }

            if (membership.user.allowEmailNoti) {
                try {
                    await this.mailService.sendMembershipExpiryReminder(
                        membership.user.email,
                        reminderHour,
                        membership.endDate,
                    );
                } catch (error) {
                    this.logger.error(`Send membership reminder failed for ${membership.user.email}: ${error}`);
                }
            }
        }
    }
}
