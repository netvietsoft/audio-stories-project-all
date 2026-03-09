import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagesHelperService } from './packages-helper.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VietQRService {
  private readonly logger = new Logger(VietQRService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesHelper: PackagesHelperService,
  ) {}

  private get isConfigured(): boolean {
    return !!(
      (process.env.VIETQR_BANK_ID || process.env.VIETQR_ACQ_ID) &&
      process.env.VIETQR_ACCOUNT_NO &&
      process.env.VIETQR_ACCOUNT_NAME
    );
  }

  private get bankId(): string {
    return process.env.VIETQR_BANK_ID || process.env.VIETQR_ACQ_ID || '';
  }

  async createOrder(params: { userId: string; packageCode: string }) {
    if (!this.isConfigured) {
      throw new BadRequestException('VietQR is not configured');
    }

    const pkg = await this.packagesHelper.findByCode(params.packageCode);

    if (!pkg || !pkg.isActive) {
      throw new BadRequestException('Package not found or inactive');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const amountVnd = pkg.priceVnd;
    const orderId = uuidv4();
    const addInfo = `ORDER:${orderId.substring(0, 8).toUpperCase()}`;

    // Generate QR code using VietQR API
    const qrData = await this.generateQRCode(amountVnd, addInfo);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const payment = await this.prisma.payment.create({
      data: {
        id: orderId,
        userId: params.userId,
        packageCode: params.packageCode,
        status: 'PENDING',
        amountVnd: amountVnd,
        creditsAdded: pkg.credits,
        currency: 'VND',
        transactionCode: addInfo,
        qrData: qrData.qr_emv,
        qrImageBase64: qrData.qr_image,
        expiresAt: expiresAt,
      },
    });

    return {
      order_id: payment.id,
      transaction_code: payment.transactionCode,
      amount_vnd: payment.amountVnd,
      credits: payment.creditsAdded,
      qr_image: payment.qrImageBase64,
      qr_data: payment.qrData,
      expires_at: payment.expiresAt,
      bank_info: {
        bank_id: this.bankId,
        account_no: process.env.VIETQR_ACCOUNT_NO,
        account_name: process.env.VIETQR_ACCOUNT_NAME,
      },
    };
  }

  private async generateQRCode(amount: number, addInfo: string) {
    const bankId = this.bankId;
    const accountNo = process.env.VIETQR_ACCOUNT_NO;
    const accountName = process.env.VIETQR_ACCOUNT_NAME;
    const template = process.env.VIETQR_TEMPLATE || 'compact2';

    // Use VietQR.io API
    const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName || '')}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return {
        qr_image: `data:image/png;base64,${base64}`,
        qr_emv: null,
      };
    } catch (error) {
      this.logger.error('Failed to generate VietQR code', error);
      return {
        qr_image: null,
        qr_emv: null,
      };
    }
  }

  async checkOrderStatus(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: orderId },
    });

    if (!payment) {
      throw new BadRequestException('Order not found');
    }

    return {
      order_id: payment.id,
      status: payment.status,
      amount_vnd: payment.amountVnd,
      paid_at: payment.paidAt,
      expires_at: payment.expiresAt,
      is_expired: new Date() > payment.expiresAt && payment.status === 'PENDING',
    };
  }

  async processPayment(transactionCode: string, amount: number, bankTransactionId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionCode: transactionCode, status: 'PENDING' },
    });

    if (!payment) {
      this.logger.warn(`No pending payment found for transactionCode: ${transactionCode}`);
      return null;
    }

    // Verify amount (allow 1% tolerance for rounding)
    const expectedAmount = Number(payment.amountVnd);
    const tolerance = expectedAmount * 0.01;
    if (Math.abs(amount - expectedAmount) > tolerance) {
      this.logger.warn(`Amount mismatch for payment ${payment.id}: expected ${expectedAmount}, got ${amount}`);
      return null;
    }

    const now = new Date();

    await this.prisma.$transaction([
      // Update payment
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paidAt: now,
          bankTransactionId: bankTransactionId,
        },
      }),
      // Add credits to user
      this.prisma.user.update({
        where: { id: payment.userId },
        data: {
          credits: { increment: payment.creditsAdded },
        },
      }),
      // Create credit transaction
      this.prisma.creditTransaction.create({
        data: {
          userId: payment.userId,
          type: 'topup',
          amount: payment.creditsAdded,
          balanceBefore: 0, // Will be updated by trigger or service
          balanceAfter: 0,
          referenceId: payment.id,
          description: `Nạp ${payment.creditsAdded} credits qua VietQR`,
        },
      }),
    ]);

    this.logger.log(`VietQR payment processed for order ${payment.id}`);
    return payment;
  }
}
