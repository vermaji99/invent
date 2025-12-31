const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

// Service State
let transporter = null;
let resendClient = null;
let isInitialized = false;
let initializationError = null;

// Helper to get configuration
const getConfig = () => ({
  provider: (process.env.EMAIL_PROVIDER || '').toUpperCase().trim(),
  smtp: {
    host: (process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim(),
    port: Number(process.env.SMTP_PORT || 587),
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').trim(),
  },
  resendKey: (process.env.RESEND_API_KEY || '').trim(),
  fromEmail: (process.env.EMAIL_FROM || process.env.ADMIN_EMAIL || 'noreply@example.com').trim(),
  fromName: (process.env.EMAIL_FROM_NAME || 'VSKK').trim(),
  adminEmail: (process.env.ADMIN_EMAIL || '').trim(),
});

/**
 * Initialize the email service safely.
 * Must be called at startup.
 */
function initEmailService() {
  if (isInitialized) return;

  const config = getConfig();
  console.log(`[EmailService] Initializing... Provider: ${config.provider || 'NONE'}`);

  try {
    if (config.provider === 'RESEND') {
      if (!config.resendKey) throw new Error('Missing RESEND_API_KEY');
      resendClient = new Resend(config.resendKey);
      isInitialized = true;
      console.log('[EmailService] Resend client initialized.');
    } else if (config.provider === 'BREVO' || config.provider === 'SMTP') {
      if (!config.smtp.user || !config.smtp.pass) {
        throw new Error('Missing SMTP_USER or SMTP_PASS for Brevo/SMTP');
      }
      
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: false, // 587 is STARTTLS
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        },
        tls: {
          rejectUnauthorized: false // Compatible with Render free tier / shared IPs
        },
        connectionTimeout: 10000, // 10s timeout
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      isInitialized = true;
      console.log(`[EmailService] SMTP Transporter initialized (${config.smtp.host}:${config.smtp.port})`);
    } else {
      throw new Error(`Invalid EMAIL_PROVIDER: "${config.provider}". Set it to 'BREVO' or 'RESEND'.`);
    }
  } catch (err) {
    console.error(`[EmailService] CRITICAL: Initialization failed. Email sending disabled. Reason: ${err.message}`);
    initializationError = err.message;
    isInitialized = false;
    transporter = null;
    resendClient = null;
  }
}

/**
 * Log email events to DB
 */
async function logEvent(type, status, recipients, error = '') {
  try {
    await NotificationEvent.create({
      type,
      targetModel: 'SYSTEM',
      targetId: 'N/A',
      recipients,
      status,
      error
    });
  } catch (e) {
    console.error('[EmailService] Failed to log event:', e.message);
  }
}

/**
 * Get list of admin emails
 */
async function getAdminRecipients() {
  const config = getConfig();
  const admins = await User.find({ role: 'admin', isActive: true }, { email: 1 });
  const envAdmin = config.adminEmail ? [config.adminEmail] : [];
  const set = new Set([...admins.map(a => a.email), ...envAdmin].filter(Boolean));
  return Array.from(set);
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
        Sent via VSKK System
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
 * Verify connection (SMTP only)
 */
async function verifyTransport() {
  // Ensure initialized
  if (!isInitialized) initEmailService();
  
  if (!isInitialized) {
    const msg = initializationError || 'Service not initialized';
    console.warn(`[EmailService] Verify skipped: ${msg}`);
    await logEvent('EMAIL_TRANSPORT_VERIFY', 'FAILURE', [], msg);
    return false;
  }

  const config = getConfig();
  if (config.provider === 'RESEND') {
    // Resend API is stateless, assume OK if key exists
    await logEvent('EMAIL_TRANSPORT_VERIFY', 'SUCCESS', ['SYSTEM']);
    return true;
  }

  if (transporter) {
    try {
      await transporter.verify();
      console.log('[EmailService] Connection Verified Successfully');
      await logEvent('EMAIL_TRANSPORT_VERIFY', 'SUCCESS', ['SYSTEM']);
      return true;
    } catch (e) {
      console.error('[EmailService] Verify Failed:', e.message);
      await logEvent('EMAIL_TRANSPORT_VERIFY', 'FAILURE', ['SYSTEM'], e.message);
      return false;
    }
  }

  return false;
}

/**
 * Send Email
 */
async function sendEmail({ subject, html, to }) {
  // Lazy init if needed
  if (!isInitialized) initEmailService();

  const recipients = to && to.length ? to : await getAdminRecipients();
  if (!recipients.length) return { ok: false, error: 'NO_RECIPIENTS' };

  if (!isInitialized) {
    const error = initializationError || 'Email service not initialized (Check ENV vars)';
    console.error(`[EmailService] Send Failed: ${error}`);
    await logEvent(subject, 'FAILURE', recipients, error);
    return { ok: false, error };
  }

  const config = getConfig();
  const fromAddress = `${config.fromName} <${config.fromEmail}>`;

  try {
    if (config.provider === 'RESEND') {
      const { error } = await resendClient.emails.send({
        from: fromAddress, // Resend requires verified domain or specific test email
        to: recipients,
        subject,
        html
      });
      
      if (error) throw new Error(error.message);

    } else if (transporter) {
      await transporter.sendMail({
        from: fromAddress,
        to: recipients.join(','),
        subject,
        html
      });
    } else {
      throw new Error('Transporter is null unexpectedly');
    }

    console.log(`[EmailService] Sent "${subject}" to ${recipients.length} recipients.`);
    await logEvent(subject, 'SUCCESS', recipients);
    return { ok: true };

  } catch (e) {
    console.error(`[EmailService] Send Failed: ${e.message}`);
    await logEvent(subject, 'FAILURE', recipients, e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Send Test Mail
 */
async function sendTestMail() {
  const config = getConfig();
  const to = config.adminEmail ? [config.adminEmail] : [];
  if (!to.length) {
    console.warn('[EmailService] Cannot send test email: ADMIN_EMAIL not set');
    return false;
  }
  return sendEmail({ 
    subject: 'Render Email Test', 
    html: wrapHtml('Email System Test', '<p>If you see this, the email system is working correctly on Render!</p>'), 
    to 
  });
}

module.exports = {
  initEmailService,
  sendEmail,
  verifyTransport,
  sendTestMail,
  wrapHtml,
  table,
  getAdminRecipients
};
