import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(
    @Inject('MAIL_TRANSPORT') private readonly transport: Transporter,
    private readonly cfg: ConfigService,
  ) {
    const email = this.cfg.get('SMTP_FROM') || this.cfg.get('SMTP_USER') || 'no-reply@example.com';
    this.from = `NetViet Audio <${email}>`;
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
}
