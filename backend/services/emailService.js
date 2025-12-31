const { Resend } = require('resend');
const NotificationEvent = require('../models/NotificationEvent');
const User = require('../models/User');

// --- Configuration ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// --- Initialization ---
let resend = null;
if (RESEND_API_KEY) {
  try {
    resend = new Resend(RESEND_API_KEY);
    console.log('[EmailService] Resend Client Initialized (HTTP Mode)');
  } catch (error) {
    console.error('[EmailService] Failed to initialize Resend:', error.message);
  }
} else {
  console.warn('[EmailService] WARNING: RESEND_API_KEY is missing. Email sending will be disabled.');
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
 * Send Email via Resend API (Non-blocking / Fire-and-Forget)
 * 
 * DESIGN DECISION:
 * To prevent HTTP 503 Service Unavailable errors on Render Free Tier,
 * this function returns { ok: true } IMMEDIATELY.
 * The actual email sending happens in the background.
 * Failures are logged to the console and database, but do not block the API response.
 */
async function sendEmail({ subject, html, to }) {
  // 1. Safety Checks
  if (!resend) {
    console.error('[EmailService] Failed: Resend not initialized');
    return { ok: true }; // Return success to prevent 503
  }

  // 2. Resolve Recipients (Wait for this as it's DB query, usually fast)
  let recipients = [];
  try {
    recipients = to && to.length ? to : await getAdminRecipients();
  } catch (e) {
    console.error('[EmailService] Recipient resolution failed:', e);
    return { ok: true };
  }

  if (!recipients.length) {
    console.warn('[EmailService] No recipients found');
    return { ok: true };
  }

  // 3. Fire-and-Forget Background Send
  const payload = {
    from: EMAIL_FROM,
    to: recipients,
    subject: subject,
    html: html
  };

  // Do NOT await this. Let it run in background.
  resend.emails.send(payload)
    .then(async (response) => {
      if (response.error) {
        console.error('[EmailService] Resend API Error:', response.error);
        await logEvent('EMAIL_SEND', 'FAILURE', recipients, JSON.stringify(response.error));
      } else {
        console.log(`[EmailService] Sent "${subject}" to ${recipients.length} recipients. ID: ${response.data?.id}`);
        await logEvent('EMAIL_SEND', 'SUCCESS', recipients, '', response.data);
      }
    })
    .catch(async (err) => {
      console.error('[EmailService] Network/Unexpected Error:', err.message);
      await logEvent('EMAIL_SEND', 'FAILURE', recipients, err.message);
    });

  // 4. Return Optimistic Success
  return { ok: true };
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
        Sent via VSKK System (Resend)
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
 * Dummy Verify for Server Startup
 */
async function verifyTransport() {
  if (resend) {
    console.log('[EmailService] Resend API Client Ready');
    return true;
  }
  return false;
}

// No-op for compatibility
function initEmailService() {}

async function sendTestMail() {
    await sendEmail({
        subject: 'Test Email (Resend)',
        html: '<p>This is a test email from the new HTTP-based email service.</p>',
        to: [ADMIN_EMAIL]
    });
}

module.exports = {
  sendEmail,
  wrapHtml,
  table,
  verifyTransport,
  initEmailService,
  sendTestMail
};
