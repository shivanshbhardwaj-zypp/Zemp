// Sends one email from the domain's no-reply address over HTTPS (Resend API) — no SMTP.
// Needs RESEND_API_KEY and SMTP_FROM (e.g. "ZEMP <no-reply@zypp.app>", domain verified in Resend)
// in backend/.env or the environment.
// Usage: node --env-file-if-exists=.env scripts/send-test-email.mjs you@example.com
const to = process.argv[2];
if (!to) throw new Error('Usage: node scripts/send-test-email.mjs <recipient>');
const key = process.env.RESEND_API_KEY;
const from = process.env.SMTP_FROM;
if (!key || !from) {
  console.error('Set RESEND_API_KEY and SMTP_FROM (a no-reply address on a domain verified in Resend).');
  process.exit(1);
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from,
    to,
    subject: 'ZEMP test email',
    text: 'This is a test email from ZEMP. If you can read it, task and deadline reminder emails will reach you too.',
  }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}): ${body}`);
  process.exit(1);
}
console.log(`Sent to ${to} from ${from} — ${body}`);
