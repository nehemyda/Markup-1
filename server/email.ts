// Email to the team (e.g. "client submitted a revision"), sent through an SMTP server. With Google Workspace:
// SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=the sending account, SMTP_PASS=its App Password (or Google's
// smtp-relay service). Off until SMTP_HOST is set: nothing is sent and nothing fails. A failed email is logged and
// never stops the action that sent it.
import nodemailer from 'nodemailer';

let transport: nodemailer.Transporter | null = null;

export const emailEnabled = () => !!process.env.SMTP_HOST;

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
    });
  }
  return transport;
}

const escape = (text: string) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// A plain message with one button; `lines` become paragraphs
export async function sendEmail(to: string[], subject: string, lines: string[], button?: { label: string; url: string }) {
  const recipients = [...new Set(to.map((t) => t.trim().toLowerCase()).filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)))];
  if (!emailEnabled() || !recipients.length) return;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
${lines.map((l) => `<p style="margin:0 0 12px">${escape(l)}</p>`).join('\n')}
${button ? `<p style="margin:20px 0"><a href="${escape(button.url)}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escape(button.label)}</a></p>` : ''}
</div>`;
  const text = [...lines, button ? `${button.label}: ${button.url}` : ''].filter(Boolean).join('\n\n');
  try {
    // One email per person, so nobody sees the other addresses
    await Promise.all(
      recipients.map((address) =>
        getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: address, subject, text, html })
      )
    );
  } catch (err: any) {
    console.warn('Email not sent:', err?.message || err);
  }
}

// For tests: send through another transport (e.g. one that only records the message)
export function useTransport(t: nodemailer.Transporter) {
  transport = t;
}
