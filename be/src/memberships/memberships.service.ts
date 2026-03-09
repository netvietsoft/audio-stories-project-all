import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MembershipQueryDto } from './dto/membership-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MembershipsService {
    constructor(private readonly prisma: PrismaService) { }

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
}
