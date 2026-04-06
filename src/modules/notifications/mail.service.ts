import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly settingsService: SettingsService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(userId: string, subject: string, body: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.email) return;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      this.logger.warn(`[Email Service (Console Fallback)] Sending to ${user.email}: ${subject} - ${body}`);
      return;
    }

    const settings = await this.settingsService.getSettings();
    const companyName = settings?.company_name || 'BMS Management';
    // Link directly to the frontend's notifications page, defaulting to localhost if not set in config
    const actionUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/notifications`;
    const htmlBody = this.generateHtmlTemplate(subject, body, companyName, actionUrl);

    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || `"BMS App" <noreply@example.com>`,
        to: user.email,
        subject,
        text: body, // Plain text fallback
        html: htmlBody,
      });
      this.logger.log(`[Email Service] Successfully sent branded email to ${user.email}: ${subject}`);
    } catch (error) {
      this.logger.error(`[Email Service] Failed to send email to ${user.email}`, error);
    }
  }

  private generateHtmlTemplate(title: string, message: string, companyName: string, actionUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7f9; color: #333; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f9; padding-bottom: 40px; }
        .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; }
        .header { background: linear-gradient(135deg, #1a2b3c 0%, #2c3e50 100%); padding: 30px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
        .content { padding: 40px 30px; line-height: 1.6; font-size: 16px; }
        .content h2 { color: #1a2b3c; margin-top: 0; }
        .footer { padding: 20px 30px; text-align: center; font-size: 12px; color: #777; }
        .button { display: inline-block; padding: 12px 25px; background-color: #3498db; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
        .preheader { display: none; max-width: 0; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; }
    </style>
</head>
<body>
    <span class="preheader">${message.substring(0, 50)}...</span>
    <div class="wrapper">
        <table class="main">
            <tr>
                <td class="header">
                    <h1>${companyName}</h1>
                </td>
            </tr>
            <tr>
                <td class="content">
                    <h2>${title}</h2>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                    <a href="${actionUrl}" class="button">View Details</a>
                </td>
            </tr>
            <tr>
                <td class="footer">
                    &copy; ${new Date().getFullYear()} ${companyName}. This is an automated system notification.
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
    `;
  }
}
