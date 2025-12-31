const nodemailer = require('nodemailer');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 0) || undefined,
  secure: process.env.EMAIL_SECURE === 'true' ? true : undefined,
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.APP_PASSWORD
  }
});

async function getAdminRecipients() {
  const admins = await User.find({ role: 'admin', isActive: true }, { email: 1 });
  const envAdmin = process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
  const set = new Set([...admins.map(a => a.email), ...envAdmin].filter(Boolean));
  return Array.from(set);
}

function wrapHtml(title, bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2 style="color:#0A1F44;">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}

async function sendEmail({ subject, html, to }) {
  const recipients = to && to.length ? to : await getAdminRecipients();
  if (!recipients.length) return { ok: false, error: 'NO_ADMIN_RECIPIENTS' };
  try {
    await transporter.sendMail({
      from: process.env.ADMIN_EMAIL,
      to: recipients.join(','),
      subject,
      html
    });
    await NotificationEvent.create({
      type: subject,
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients,
      status: 'SUCCESS'
    });
    return { ok: true };
  } catch (e) {
    await NotificationEvent.create({
      type: subject,
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients,
      status: 'FAILURE',
      error: String(e.message || e)
    });
    return { ok: false, error: 'SEND_FAILED' };
  }
}

function table(headers, rows) {
  const th = headers.map(h => `<th style="border:1px solid #ccc;padding:8px;background:#f6f8fa">${h}</th>`).join('');
  const tr = rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ccc;padding:8px">${c}</td>`).join('')}</tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

module.exports = {
  sendEmail,
  wrapHtml,
  table,
  getAdminRecipients
};

