const SibApiV3Sdk = require('@sendinblue/client');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_FROM = process.env.EMAIL_FROM;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

let emailClient = null;
let isInitialized = false;

function initEmailService() {
  if (isInitialized) return;
  try {
    if (!BREVO_API_KEY) {
      console.error('[EmailService] BREVO_API_KEY is missing');
      return;
    }
    if (!EMAIL_FROM) {
      console.error('[EmailService] EMAIL_FROM is missing');
      return;
    }
    emailClient = new SibApiV3Sdk.TransactionalEmailsApi();
    emailClient.setApiKey(SibApiV3Sdk.AuthenticationApiKeys.apiKey, BREVO_API_KEY);
    isInitialized = true;
    console.log('[EmailService] Brevo Transactional API initialized');
  } catch (error) {
    console.error('[EmailService] Failed to initialize Brevo API:', error.message);
  }
}

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

async function sendEmail({ subject, html, to }) {
  if (!isInitialized || !emailClient) {
    initEmailService();
    if (!emailClient) {
      return { ok: false, error: 'Email service not initialized' };
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

  try {
    console.log(`[EmailService] Sending "${subject}" to ${recipients.join(', ')}...`);
    const payload = {
      sender: { email: EMAIL_FROM },
      to: recipients.map(email => ({ email })),
      subject,
      htmlContent: html
    };
    const timeoutMs = Number(process.env.EMAIL_API_TIMEOUT_MS || 10000);
    const apiCall = emailClient.sendTransacEmail(payload);
    const response = await Promise.race([
      apiCall,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Brevo API timeout')), timeoutMs))
    ]);
    await logEvent('EMAIL_SEND', 'SUCCESS', recipients, '', response);
    return { ok: true, id: response?.messageId || response?.message || 'OK' };

  } catch (error) {
    console.error('[EmailService] Brevo API Error:', error.message);
    await logEvent('EMAIL_SEND', 'FAILURE', recipients, error.message);
    return { ok: false, error: error.message };
  }
}

function wrapHtml(title, bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#0A1F44; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
      <div style="padding: 20px 0;">
        ${bodyHtml}
      </div>
      <div style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
        Sent via VSKK System (Brevo API)
      </div>
    </div>
  `;
}

function table(headers, rows) {
  const th = headers.map(h => `<th style="border:1px solid #ccc;padding:8px;background:#f6f8fa;text-align:left;">${h}</th>`).join('');
  const tr = rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ccc;padding:8px">${c}</td>`).join('')}</tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

async function verifyTransport() {
  if (!isInitialized) initEmailService();
  const ok = !!emailClient;
  if (ok) console.log('[EmailService] Brevo API ready');
  return ok;
}

async function sendOTP(toEmail, otp) {
  const subject = 'Your OTP Code';
  const html = wrapHtml('Verification Code', `
    <p>Use the following OTP to verify your login:</p>
    <p style="font-size:22px;font-weight:bold;letter-spacing:2px">${otp}</p>
    <p>This OTP expires in 10 minutes.</p>
  `);
  return await sendEmail({ subject, html, to: [toEmail] });
}

async function sendTestMail() {
  const to = ADMIN_EMAIL ? [ADMIN_EMAIL] : [];
  if (!to.length) {
    console.warn('[EmailService] ADMIN_EMAIL not set; skipping test email');
    return { ok: false, error: 'ADMIN_EMAIL not set' };
  }
  return await sendEmail({
    subject: 'Test Email (Brevo API)',
    html: '<p>This is a test email from the Brevo Transactional API service.</p>',
    to
  });
}

// Auto-init
initEmailService();

module.exports = {
  sendEmail,
  sendOTP,
  wrapHtml,
  table,
  verifyTransport,
  initEmailService,
  sendTestMail
};
