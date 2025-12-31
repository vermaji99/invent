const nodemailer = require('nodemailer');
const axios = require('axios');
const { Resend } = require('resend');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

const authUser = (process.env.EMAIL_USER || process.env.ADMIN_EMAIL || '').trim();
const authPass = (process.env.EMAIL_PASS || process.env.APP_PASSWORD || '').replace(/\s+/g, '');
const emailFrom = (process.env.EMAIL_FROM || authUser || '').trim();
const emailFromName = (process.env.EMAIL_FROM_NAME || 'VSKK').trim();
const requireTLS = process.env.EMAIL_REQUIRE_TLS === 'true';
const enableLogger = process.env.EMAIL_DEBUG === 'true';
const authMethod = process.env.EMAIL_AUTH_METHOD || undefined;
const configuredHost = (process.env.EMAIL_HOST || '').trim().toLowerCase();
const useService = !configuredHost || configuredHost === 'localhost' || configuredHost === '127.0.0.1';
const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
const resendKeyGlobal = process.env.RESEND_API_KEY || '';
const resendClient = resendKeyGlobal ? new Resend(resendKeyGlobal) : null;

let transporter = null;
if (provider === 'brevo') {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: (process.env.SMTP_USER || authUser).trim(),
      pass: (process.env.SMTP_PASS || authPass).trim()
    },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
    requireTLS: true,
    logger: enableLogger,
    debug: enableLogger
  });
} else if (configuredHost && provider !== 'resend') {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: authUser, pass: authPass },
    authMethod,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
    requireTLS,
    logger: enableLogger,
    debug: enableLogger
  });
}

function buildFallbackTransport587() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: authUser, pass: authPass },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
    requireTLS: true,
    logger: enableLogger,
    debug: enableLogger
  });
}

function buildFallbackTransport465() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: authUser, pass: authPass },
    tls: { minVersion: 'TLSv1.2' },
    requireTLS,
    logger: enableLogger,
    debug: enableLogger
  });
}

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
  const fromAddress = `${emailFromName} <${emailFrom || authUser}>`;
  const resendKey = process.env.RESEND_API_KEY || resendKeyGlobal;
  const useResend = provider === 'resend' && !!resendKey && !!resendClient;
  const resendFrom = `${emailFromName} <${(process.env.EMAIL_FROM || 'onboarding@resend.dev').trim()}>`;
  try {
    if (useResend) {
      const r = await resendClient.emails.send({
        from: resendFrom,
        to: recipients,
        subject,
        html
      });
      if (r.error) throw new Error(String(r.error?.message || 'RESEND_SEND_FAILED'));
    } else {
      await transporter.sendMail({
        from: fromAddress,
        to: recipients.join(','),
        subject,
        html
      });
    }
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
    if (useResend) {
      return { ok: false, error: 'SEND_FAILED' };
    }
    // Retry with SMTP fallbacks
    try {
      const fb587 = buildFallbackTransport587();
      await fb587.verify().catch(() => {});
      await fb587.sendMail({
        from: fromAddress,
        to: recipients.join(','),
        subject,
        html
      });
      await NotificationEvent.create({
        type: subject + '_FALLBACK',
        targetModel: 'SYSTEM',
        targetId: 'N/A',
        recipients,
        status: 'SUCCESS'
      });
      return { ok: true };
    } catch (e2) {
      try {
        const fb465 = buildFallbackTransport465();
        await fb465.verify().catch(() => {});
        await fb465.sendMail({
          from: fromAddress,
          to: recipients.join(','),
          subject,
          html
        });
        await NotificationEvent.create({
          type: subject + '_FALLBACK_SSL',
          targetModel: 'SYSTEM',
          targetId: 'N/A',
          recipients,
          status: 'SUCCESS'
        });
        return { ok: true };
      } catch (e3) {
        await NotificationEvent.create({
          type: subject + '_FALLBACK_SSL',
          targetModel: 'SYSTEM',
          targetId: 'N/A',
          recipients,
          status: 'FAILURE',
          error: String(e2.message || e2) + ' | ' + String(e3.message || e3)
        });
        return { ok: false, error: 'SEND_FAILED' };
      }
    }
  }
}

async function verifyTransport() {
  if (provider === 'resend' && resendClient) {
    await NotificationEvent.create({
      type: 'EMAIL_TRANSPORT_VERIFY',
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients: [process.env.ADMIN_EMAIL].filter(Boolean),
      status: 'SUCCESS'
    });
    return true;
  }
  try {
    await transporter.verify();
    await NotificationEvent.create({
      type: 'EMAIL_TRANSPORT_VERIFY',
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients: [process.env.ADMIN_EMAIL].filter(Boolean),
      status: 'SUCCESS'
    });
    return true;
  } catch (e) {
    await NotificationEvent.create({
      type: 'EMAIL_TRANSPORT_VERIFY',
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients: [process.env.ADMIN_EMAIL].filter(Boolean),
      status: 'FAILURE',
      error: String(e.message || e)
    });
    return false;
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
  getAdminRecipients,
  verifyTransport
};
