const nodemailer = require('nodemailer');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

// --- Configuration ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@example.com';

// --- Initialization ---
let transporter = null;
let isInitialized = false;

function initEmailService() {
  if (isInitialized) return;

  const provider = (process.env.EMAIL_PROVIDER || 'BREVO').toUpperCase();

  // Strict: We are using Brevo SMTP.
  // Defaults to Brevo settings if not provided in ENV, but PASS is required.
  const config = {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS
  };

  if (!config.pass) {
    console.warn('[EmailService] WARNING: SMTP_PASS is missing. Email sending will fail.');
    // We don't throw here to allow server to start, but sending will fail.
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass
      },
      // Render Free Tier Compatibility
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    isInitialized = true;
    console.log(`[EmailService] SMTP Transporter Initialized (${config.host}:${config.port})`);
  } catch (error) {
    console.error('[EmailService] Failed to initialize transporter:', error.message);
  }
}

/**
 * Log email events to DB
 */
async function logEvent(type, status, recipients, error = '', data = null) {
  try {
    await NotificationEvent.create({
      type,
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients,
      status,
      error,
      metadata: data
    });
  } catch (e) {
    console.error('[EmailService] Failed to log event:', e.message);
  }
}

/**
 * Get list of admin emails
 */
async function getAdminRecipients() {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }, { email: 1 });
    const envAdmin = ADMIN_EMAIL ? [ADMIN_EMAIL] : [];
    const set = new Set([...admins.map(a => a.email), ...envAdmin].filter(Boolean));
    return Array.from(set);
  } catch (error) {
    console.error('[EmailService] Error fetching admins:', error);
    return [];
  }
}

/**
 * Send Email via SMTP
 */
async function sendEmail({ subject, html, to }) {
  if (!isInitialized || !transporter) {
    initEmailService();
    if (!transporter) {
      return { ok: false, error: 'Email service not initialized (Check SMTP_PASS)' };
    }
  }

  let recipients = [];
  try {
    recipients = to && to.length ? to : await getAdminRecipients();
  } catch (e) {
    return { ok: false, error: 'Recipient resolution failed: ' + e.message };
  }

  if (!recipients.length) {
    return { ok: false, error: 'No recipients found' };
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to: recipients.join(','),
    subject: subject,
    html: html
  };

  try {
    console.log(`[EmailService] Sending "${subject}" to ${recipients.join(', ')}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Success! Message ID: ${info.messageId}`);
    
    await logEvent('EMAIL_SEND', 'SUCCESS', recipients, '', info);
    return { ok: true, id: info.messageId };

  } catch (error) {
    console.error('[EmailService] SMTP Error:', error.message);
    await logEvent('EMAIL_SEND', 'FAILURE', recipients, error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * HTML Wrapper
 */
function wrapHtml(title, bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#0A1F44; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
      <div style="padding: 20px 0;">
        ${bodyHtml}
      </div>
      <div style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
        Sent via VSKK System (Brevo SMTP)
      </div>
    </div>
  `;
}

/**
 * Table generator
 */
function table(headers, rows) {
  const th = headers.map(h => `<th style="border:1px solid #ccc;padding:8px;background:#f6f8fa;text-align:left;">${h}</th>`).join('');
  const tr = rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ccc;padding:8px">${c}</td>`).join('')}</tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/**
 * Verify Transport
 */
async function verifyTransport() {
  if (!isInitialized) initEmailService();
  if (!transporter) return false;

  try {
    await transporter.verify();
    console.log('[EmailService] Transport Verified: Ready to send');
    return true;
  } catch (error) {
    console.error('[EmailService] Transport Verification Failed:', error.message);
    return false;
  }
}

async function sendTestMail() {
    console.log('[EmailService] Sending test email...');
    await sendEmail({
        subject: 'Test Email (Brevo SMTP)',
        html: '<p>This is a test email from the Brevo SMTP service.</p>',
        to: [ADMIN_EMAIL]
    });
}

// Auto-init
initEmailService();

module.exports = {
  sendEmail,
  wrapHtml,
  table,
  verifyTransport,
  initEmailService,
  sendTestMail
};
