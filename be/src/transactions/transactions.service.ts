import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAllPayments(query: TransactionQueryDto) {
        const { page = 1, limit = 20, search, status } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.PaymentWhereInput = {
            ...(status ? { status } : {}),
            ...(search
                ? {
                    OR: [
                        { transactionCode: { contains: search } },
                        { packageCode: { contains: search } },
                        { user: { email: { contains: search } } },
                        { user: { displayName: { contains: search } } },
                    ],
                }
                : {}),
        };

        const [payments, total] = await Promise.all([
            this.prisma.payment.findMany({
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
                        },
                    },
                },
            }),
            this.prisma.payment.count({ where }),
        ]);

        return {
            data: payments,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getPaymentStats() {
        const [totalRevenue, successCount, pendingCount, failedCount] = await Promise.all([
            this.prisma.payment.aggregate({
                where: { status: 'SUCCESS' },
                _sum: { amountVnd: true },
            }),
            this.prisma.payment.count({ where: { status: 'SUCCESS' } }),
            this.prisma.payment.count({ where: { status: 'PENDING' } }),
            this.prisma.payment.count({ where: { status: 'FAILED' } }),
        ]);

        return {
            totalRevenue: totalRevenue._sum.amountVnd || 0,
            successCount,
            pendingCount,
            failedCount,
        };
    }
}
