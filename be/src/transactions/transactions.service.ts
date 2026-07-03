import { Injectable, NotFoundException } from '@nestjs/common';
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
                    pulseAdded: true,
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
                    pulseAmount: true,
                    pulseBalanceBefore: true,
                    pulseBalanceAfter: true,
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
                        pulseAdded: item.pulseAdded,
                },
            })),
            ...credits.map((item) => ({
                id: `credit:${item.id}`,
                source: 'credit' as const,
                createdAt: item.createdAt,
                    amount: item.pulseAmount,
                status: 'SUCCESS',
                content: item.description || `Giao dich ${item.type}`,
                metadata: {
                    creditTransactionId: item.id,
                    type: item.type,
                    referenceId: item.referenceId,
                        balanceBefore: item.pulseBalanceBefore,
                        balanceAfter: item.pulseBalanceAfter,
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

    async findAllGifts(query: TransactionQueryDto) {
        const { page = 1, limit = 20, search } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.CreditTransactionWhereInput = {
            type: 'spend',
            description: { contains: 'Tặng' },
            ...(search
                ? {
                    OR: [
                        { description: { contains: search } },
                        { user: { email: { contains: search } } },
                        { user: { displayName: { contains: search } } },
                    ],
                }
                : {}),
        };

        const [gifts, total] = await Promise.all([
            this.prisma.creditTransaction.findMany({
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
            this.prisma.creditTransaction.count({ where }),
        ]);

        return {
            data: gifts,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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
        const payment = await this.prisma.payment.findUnique({
            where: { id },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // H10: CreditTransaction được ghi với referenceId KHÁC nhau tuỳ provider:
        //   - VietQR  → referenceId = payment.id
        //   - Stripe  → referenceId = providerPaymentId (session.id)
        // Cũ chỉ xoá theo payment.id nên bản ghi Stripe bị mồ côi + Pulse không hoàn.
        // Khớp cả hai khoá, hoàn (claw back) đúng số Pulse đã cộng, trong 1 transaction.
        const refIds = [payment.id, payment.providerPaymentId].filter(
            (x): x is string => !!x,
        );

        await this.prisma.$transaction(async (tx) => {
            const related = await tx.creditTransaction.findMany({
                where: { referenceId: { in: refIds }, userId: payment.userId },
            });

            // Tổng Pulse đã NẠP qua payment này (type 'topup', pulseAmount > 0).
            const pulseToClawBack = related
                .filter((t) => t.type === 'topup' && t.pulseAmount > 0)
                .reduce((sum, t) => sum + t.pulseAmount, 0);

            // Xoá các CreditTransaction gốc của payment (mọi provider) TRƯỚC,
            // để dòng audit 'refund' tạo sau (cùng referenceId=payment.id) không bị cuốn theo.
            await tx.creditTransaction.deleteMany({
                where: { referenceId: { in: refIds } },
            });

            if (pulseToClawBack > 0) {
                const user = await tx.user.findUnique({
                    where: { id: payment.userId },
                    select: { pulseBalance: true },
                });
                if (user) {
                    // clamp >=0 để không âm nếu user đã tiêu bớt.
                    const newBalance = Math.max(0, user.pulseBalance - pulseToClawBack);
                    await tx.user.update({
                        where: { id: payment.userId },
                        data: { pulseBalance: newBalance },
                    });
                    // Ghi 1 dòng sổ cái 'refund' để giữ audit trail (before/after).
                    await tx.creditTransaction.create({
                        data: {
                            userId: payment.userId,
                            type: 'refund',
                            pulseAmount: -pulseToClawBack,
                            pulseBalanceBefore: user.pulseBalance,
                            pulseBalanceAfter: newBalance,
                            referenceId: payment.id,
                            description: `Hoàn Pulse do xoá payment ${payment.id}`,
                        },
                    });
                }
            }

            await tx.payment.delete({ where: { id } });
        });

        return { success: true, message: 'Payment deleted successfully' };
    }

    async donatePulse(userId: string, amount: number, description: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { pulseBalance: true },
        });

        if (!user) throw new Error('User not found');
        if (user.pulseBalance < amount) throw new Error('Insufficient Pulse');

        return this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { pulseBalance: { decrement: amount } },
                select: { pulseBalance: true },
            });

            const transaction = await tx.creditTransaction.create({
                data: {
                    userId,
                    type: 'spend',
                    pulseAmount: -amount, // Negative for spending
                    pulseBalanceBefore: user.pulseBalance,
                    pulseBalanceAfter: updatedUser.pulseBalance,
                    description,
                },
            });

                return {
                    success: true,
                    newBalance: updatedUser.pulseBalance,
                    transactionId: transaction.id,
                };
        });
    }
}
