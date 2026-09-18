import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { CONFIG, type AppConfig } from '../../config/env.js';

/**
 * Every notification (task assigned/reassigned/blocked/completed, deadline reminders, review
 * decisions, comments...) also goes out as email, reusing its own title and body. Fire-and-forget:
 * a slow or failing mail server must never hold up or break the action that triggered it.
 *
 * With no SMTP_HOST configured, sends are logged instead of delivered — useful for local dev
 * without real credentials, never silent about it.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private warnedNotConfigured = false;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.transporter = config.SMTP_HOST
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
        })
      : null;
  }

  send(to: string, subject: string, text: string): void {
    if (!this.transporter) {
      if (!this.warnedNotConfigured) {
        this.logger.warn('SMTP_HOST is not set — emails are logged, not sent. See backend/.env.example.');
        this.warnedNotConfigured = true;
      }
      this.logger.debug(`[email not sent] to=${to} subject="${subject}"`);
      return;
    }
    this.transporter
      .sendMail({ from: this.config.SMTP_FROM, to, subject, text })
      .then((info) => {
        const previewUrl = nodemailer.getTestMessageUrl(info); // only truthy for an Ethereal test account
        this.logger.log(`Emailed ${to}${previewUrl ? ` — preview: ${previewUrl}` : ''}`);
      })
      .catch((error: unknown) => this.logger.error(`Failed to email ${to}: ${(error as Error).message}`));
  }
}
