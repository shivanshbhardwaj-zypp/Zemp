// Sends one sample email through the same SMTP settings the API uses (SMTP_* in backend/.env or
// the host's environment), to prove mail delivery end to end.
// Usage: node --env-file-if-exists=.env scripts/send-test-email.mjs you@example.com
import nodemailer from 'nodemailer';

const to = process.argv[2];
if (!to) throw new Error('Usage: node scripts/send-test-email.mjs <recipient>');
if (!process.env.SMTP_HOST) {
  console.error('SMTP_HOST is not set — no mail provider configured. See backend/.env.example.');
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

const info = await transport.sendMail({
  from: process.env.SMTP_FROM ?? 'ZEMP <no-reply@zemp.local>',
  to,
  subject: 'ZEMP test email',
  text: 'This is a test email from ZEMP. If you can read it, task and deadline reminder emails will reach you too.',
});
console.log(`Sent to ${to} — message id ${info.messageId}`);
