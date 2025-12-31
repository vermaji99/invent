const { Resend } = require('resend');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

// --- Configuration ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER;

// --- Initialization ---
let resend = null;

function initEmailService() {
  // STRICT RULE: Force RESEND
  if (EMAIL_PROVIDER !== 'RESEND') {
    const error = `CRITICAL: EMAIL_PROVIDER must be set to "RESEND". Found: "${EMAIL_PROVIDER}"`;
    console.error(error);
    throw new Error(error);
  }

  if (!RESEND_API_KEY) {
    const error = 'CRITICAL: RESEND_API_KEY is missing in environment variables.';
    console.error(error);
    throw new Error(error);
  }

  try {
    resend = new Resend(RESEND_API_KEY);
    console.log('[EmailService] Resend Client Initialized Successfully (HTTP Mode)');
  } catch (error) {
    console.error('[EmailService] Failed to initialize Resend client:', error.message);
    throw error;
  }
}

/**
 * Log email events to DB (Asynchronous)
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
 * Send Email via Resend API (BLOCKING / RELIABLE)
 * 
 * STRICT REQUIREMENT:
 * This function waits for the Resend API to confirm delivery (or acceptance).
 * It returns the actual result to the caller.
 * No fake success responses.
 */
async function sendEmail({ subject, html, to }) {
  // 1. Safety Checks
  if (!resend) {
    try {
      initEmailService();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // 2. Resolve Recipients
  let recipients = [];
  try {
    recipients = to && to.length ? to : await getAdminRecipients();
  } catch (e) {
    return { ok: false, error: 'Recipient resolution failed: ' + e.message };
  }

  if (!recipients.length) {
    return { ok: false, error: 'No recipients found' };
  }

  // 3. Blocking Send
  try {
    const payload = {
      from: EMAIL_FROM,
      to: recipients,
      subject: subject,
      html: html
    };

    console.log(`[EmailService] Sending "${subject}" to ${recipients.join(', ')}...`);
    
    // Await the API call
    const response = await resend.emails.send(payload);

    if (response.error) {
      console.error('[EmailService] Resend API Error:', response.error);
      await logEvent('EMAIL_SEND', 'FAILURE', recipients, JSON.stringify(response.error));
      return { ok: false, error: response.error.message || 'Resend API Error' };
    }

    console.log(`[EmailService] Success! ID: ${response.data?.id}`);
    await logEvent('EMAIL_SEND', 'SUCCESS', recipients, '', response.data);
    
    return { ok: true, id: response.data?.id };

  } catch (err) {
    console.error('[EmailService] Network/Unexpected Error:', err.message);
    await logEvent('EMAIL_SEND', 'FAILURE', recipients, err.message);
    return { ok: false, error: err.message };
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
        Sent via VSKK System (Resend HTTP)
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
 * Verify Transport (Resend Check)
 */
async function verifyTransport() {
  try {
    if (!resend) initEmailService();
    // Resend doesn't have a "verify" method like SMTP, but we can assume if init passed, we are good.
    // We could try sending a dummy email, but that consumes quota.
    return true;
  } catch (e) {
    console.error('[EmailService] Verification Failed:', e.message);
    return false;
  }
}

async function sendTestMail() {
    console.log('[EmailService] Sending test email...');
    await sendEmail({
        subject: 'Test Email (Resend Strict)',
        html: '<p>This is a test email from the STRICT Resend service.</p>',
        to: [ADMIN_EMAIL]
    });
}

// Auto-initialize on module load if possible, or wait for explicit call
try {
  initEmailService();
} catch (e) {
  // Allow server to start even if config is bad, but logs will show error
  console.warn('[EmailService] Startup initialization warning:', e.message);
}

module.exports = {
  sendEmail,
  wrapHtml,
  table,
  verifyTransport,
  initEmailService,
  sendTestMail
};
