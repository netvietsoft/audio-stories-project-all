import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
    constructor(private readonly prisma: PrismaService) { }

    async findMyTransactions(userId: string, page = 1, limit = 20) {
        const safeLimit = Math.min(Math.max(limit, 1), 50);

        const [payments, credits] = await Promise.all([
            this.prisma.payment.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                select: {
                    id: true,
                    amountVnd: true,
                    creditsAdded: true,
                    status: true,
                    packageCode: true,
                    transactionCode: true,
                    createdAt: true,
                    paidAt: true,
                },
            }),
            this.prisma.creditTransaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    balanceBefore: true,
                    balanceAfter: true,
                    description: true,
                    referenceId: true,
                    createdAt: true,
                },
            }),
        ]);

        const merged = [
            ...payments.map((item) => ({
                id: `payment:${item.id}`,
                source: 'payment' as const,
                createdAt: item.createdAt,
                amount: item.amountVnd,
                status: item.status,
                content: `Nap goi ${item.packageCode}${item.transactionCode ? ` (${item.transactionCode})` : ''}`,
                metadata: {
                    paymentId: item.id,
                    paidAt: item.paidAt,
                    creditsAdded: item.creditsAdded,
                },
            })),
            ...credits.map((item) => ({
                id: `credit:${item.id}`,
                source: 'credit' as const,
                createdAt: item.createdAt,
                amount: item.amount,
                status: 'SUCCESS',
                content: item.description || `Giao dich ${item.type}`,
                metadata: {
                    creditTransactionId: item.id,
                    type: item.type,
                    referenceId: item.referenceId,
                    balanceBefore: item.balanceBefore,
                    balanceAfter: item.balanceAfter,
                },
            })),
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const start = (page - 1) * safeLimit;
        const end = start + safeLimit;

        return {
            data: merged.slice(start, end),
            meta: {
                total: merged.length,
                page,
                lastPage: Math.max(1, Math.ceil(merged.length / safeLimit)),
            },
        };
    }

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

    async deletePayment(id: string) {
        // Check if payment exists
        const payment = await this.prisma.payment.findUnique({
            where: { id },
        });

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Delete related credit transactions first
        await this.prisma.creditTransaction.deleteMany({
            where: { referenceId: id },
        });

        // Delete the payment
        await this.prisma.payment.delete({
            where: { id },
        });

        return { success: true, message: 'Payment deleted successfully' };
    }

    async donateCredits(userId: string, amount: number, description: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true },
        });

        if (!user) throw new Error('User not found');
        if (user.credits < amount) throw new Error('Insufficient credits');

        return this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { credits: { decrement: amount } },
                select: { credits: true },
            });

            const transaction = await tx.creditTransaction.create({
                data: {
                    userId,
                    amount: -amount, // Negative for spending
                    type: 'spend',
                    balanceBefore: user.credits,
                    balanceAfter: updatedUser.credits,
                    description,
                },
            });

            return {
                success: true,
                newBalance: updatedUser.credits,
                transactionId: transaction.id,
            };
        });
    }
}
