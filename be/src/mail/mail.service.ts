import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../shared/config/app-config.service';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(
    @Inject('MAIL_TRANSPORT') private readonly transport: Transporter,
    private readonly cfg: AppConfigService,
  ) {
    this.from = `NetViet Audio <${this.cfg.mail.from}>`;
  }

  async sendVerifyEmail(to: string, link: string) {
    return await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Verify your email',
      html: `
        <h3>Verify your email</h3>
        <p>Click the link below to verify your email:</p>
        <p><a href="${link}">${link}</a></p>
        <p>If you didn't request this, please ignore.</p>
      `,
    });
  }

  async sendResetPassword(to: string, link: string) {
    return await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Reset your password',
      html: `
        <h3>Reset password</h3>
        <p>Click the link below to set a new password:</p>
        <p><a href="${link}">${link}</a></p>
        <p>This link will expire soon.</p>
      `,
    });
  }

  async sendResetPasswordCode(to: string, code: string) {
    return await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Password reset code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>Use the verification code below to reset your password. The code will expire in 10 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f5f5f5; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px 40px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
            </div>
          </div>
          <p style="color: #999; font-size: 14px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  }

  async sendVerificationCode(to: string, code: string) {
    return await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>A verification code has been sent to <strong>${to}</strong></p>
          <p>Please enter the verification code below. The code will expire in 10 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f5f5f5; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px 40px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
            </div>
          </div>
          <p style="color: #999; font-size: 14px;">If you didn't request this verification code, please ignore this email.</p>
        </div>
      `,
    });
  }

  async sendMembershipExpiryReminder(to: string, hoursLeft: number, endDate: Date) {
    const endAt = endDate.toLocaleString('vi-VN');

    return await this.transport.sendMail({
      from: this.from,
      to,
      subject: `Goi hoi vien sap het han trong ${hoursLeft} gio`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Nhac nho goi hoi vien sap het han</h2>
          <p>Goi hoi vien cua ban se het han trong khoang <strong>${hoursLeft} gio</strong>.</p>
          <p>Thoi diem het han du kien: <strong>${endAt}</strong>.</p>
          <p>Vui long gia han som de khong bi gian doan quyen loi VIP.</p>
        </div>
      `,
    });
  }

  // Send collaboration invite email to user
  async sendCollaborationInvite(
    to: string,
    inviterName: string,
    projectName: string,
    role: string,
  ) {
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: `You've been invited to collaborate on "${projectName}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Project Invitation</h2>
            <p><strong>${inviterName}</strong> has invited you to collaborate on <strong>"${projectName}"</strong> as <strong>${role}</strong>.</p>
            <p>Log in to your account to accept or decline this invitation.</p>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`Collaboration invite email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send collaboration invite email to ${to}:`, error);
    }
  }

  // Send notification to owner when they invite someone
  async sendInviteSentConfirmation(
    to: string,
    invitedUserEmail: string,
    projectName: string,
    role: string,
  ) {
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: `Invitation sent for "${projectName}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Invitation Sent</h2>
            <p>You have invited <strong>${invitedUserEmail}</strong> to collaborate on <strong>"${projectName}"</strong> as <strong>${role}</strong>.</p>
            <p>They will receive a notification to accept or decline.</p>
          </div>
        `,
      });
      this.logger.log(`Invite confirmation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send invite confirmation email to ${to}:`, error);
    }
  }

  // Send merge request notification to owner
  async sendMergeRequestNotification(
    to: string,
    requesterName: string,
    projectName: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
  ) {
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: `New merge request for "${projectName}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">New Merge Request</h2>
            <p><strong>${requesterName}</strong> has created a merge request for <strong>"${projectName}"</strong>.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
              <p style="margin: 5px 0;"><strong>From:</strong> ${sourceBranch} → ${targetBranch}</p>
            </div>
            <p>Log in to review and approve or reject this request.</p>
          </div>
        `,
      });
      this.logger.log(`Merge request notification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send merge request notification email to ${to}:`, error);
    }
  }

  async sendPaymentSuccessEmail(
    to: string,
    amount: number,
    pulseAmount: number,
    transactionId: string,
    paymentMethod: string,
  ) {
    try {
      const formattedAmount = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(amount);

      await this.transport.sendMail({
        from: this.from,
        to,
        subject: 'Thanh toán thành công - NetViet Audio',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background-color: #10b981; border-radius: 50%; padding: 15px; margin-bottom: 15px;">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h2 style="color: #10b981; margin: 0;">Thanh toán thành công!</h2>
              </div>

              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #166534; font-weight: bold;">Pulse đã được cộng vào tài khoản của bạn</p>
              </div>

              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #374151; margin-top: 0;">Thông tin giao dịch</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Số tiền thanh toán:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #111827; border-bottom: 1px solid #e5e7eb;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Pulse nhận được:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #10b981; border-bottom: 1px solid #e5e7eb;">+${pulseAmount.toLocaleString()} Pulse</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Phương thức:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #111827; border-bottom: 1px solid #e5e7eb;">${paymentMethod}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280;">Mã giao dịch:</td>
                    <td style="padding: 10px 0; text-align: right; font-family: monospace; color: #6b7280;">${transactionId}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <a href="${this.cfg.cors.frontendUrl || 'http://localhost:3001'}"
                   style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Về trang chủ
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="color: #9ca3af; font-size: 14px; margin: 5px 0;">Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
                <p style="color: #9ca3af; font-size: 12px; margin: 5px 0;">NetViet Audio - Nghe truyện audio chất lượng cao</p>
              </div>
            </div>
          </div>
        `,
      });
      this.logger.log(`Payment success email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send payment success email to ${to}:`, error);
    }
  }

  async sendStoryUpdateEmail(
    to: string,
    payload: {
      storyTitle: string;
      chapterNumber: number;
      chapterTitle: string | null;
      storyUrl: string;
      updateType: 'new_chapter' | 'chapter_updated';
    },
  ) {
    try {
      const subject = payload.updateType === 'new_chapter'
        ? `Truyện ${payload.storyTitle} có chương mới`
        : `Truyện ${payload.storyTitle} vừa được cập nhật`;

      const headline = payload.updateType === 'new_chapter'
        ? 'Có chương mới đang chờ bạn'
        : 'Nội dung truyện vừa được cập nhật';

      const summary = payload.updateType === 'new_chapter'
        ? `Chương ${payload.chapterNumber}: ${payload.chapterTitle} đã sẵn sàng để đọc và nghe.`
        : `Chương ${payload.chapterNumber}: ${payload.chapterTitle} vừa có nội dung mới. Bạn có thể quay lại để tiếp tục theo dõi.`;

      await this.transport.sendMail({
        from: this.from,
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc;">
            <div style="background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 1.6px; text-transform: uppercase; color: #6366f1; font-weight: 700;">NetViet Audio</p>
              <h2 style="margin: 0 0 12px; color: #0f172a;">${headline}</h2>
              <p style="margin: 0 0 20px; color: #334155; line-height: 1.6;">
                Truyện <strong>${payload.storyTitle}</strong> vừa có cập nhật mới.<br />
                ${summary}
              </p>
              <a href="${payload.storyUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;">
                Mở truyện ngay
              </a>
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                Bạn nhận được email này vì đã đăng ký nhận cập nhật của truyện và đang bật thông báo email trong cài đặt tài khoản.
              </p>
            </div>
          </div>
        `,
      });
      this.logger.log(`Story update email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send story update email to ${to}:`, error);
    }
  }
}
