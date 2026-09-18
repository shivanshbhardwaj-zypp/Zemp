/**
 * PHASE A MOCK — mirrors backend/src/modules/email/email.service.ts so the feature is live to test
 * against the mock too (deleted along with the rest of mocks/ in Phase D). Server-only: this file
 * runs inside the Next.js route handler process, never in the browser.
 */
import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null | undefined;
let warned = false;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

export function sendEmail(to: string, subject: string, text: string): void {
  const client = getTransporter();
  if (!client) {
    if (!warned) {
      console.warn('[mock email] SMTP_HOST is not set — emails are logged, not sent.');
      warned = true;
    }
    console.debug(`[mock email not sent] to=${to} subject="${subject}"`);
    return;
  }
  client
    .sendMail({ from: process.env.SMTP_FROM ?? 'ZEMP <notifications@zemp.local>', to, subject, text })
    .catch((error: unknown) => console.error(`[mock email] failed to send to ${to}:`, error));
}
