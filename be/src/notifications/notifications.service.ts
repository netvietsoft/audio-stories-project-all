import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [total, unreadCount, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        unreadCount,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async markRead(userId: string, id: string) {
    const target = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, isRead: true },
    });

    if (!target || target.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    if (target.isRead) return { ok: true };

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { ok: true, count: result.count };
  }

  async createPaymentNotification(
    userId: string,
    amount: number,
    credits: number,
    transactionId: string,
    paymentMethod: string,
  ) {
    const formattedAmount = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);

    return await this.prisma.notification.create({
      data: {
        userId,
        type: 'transaction',
        title: 'Thanh toán thành công',
        body: `Bạn đã nạp thành công ${formattedAmount} và nhận được ${credits.toLocaleString()} credits qua ${paymentMethod}.`,
        metadata: {
          transactionId,
          amount,
          credits,
          paymentMethod,
        },
      },
    });
  }
}
