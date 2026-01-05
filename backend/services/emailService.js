const SibApiV3Sdk = require("@sendinblue/client");

let apiInstance = null;
let initialized = false;

function initEmailService() {
  if (initialized) return;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM;

  try {
    if (!BREVO_API_KEY) {
      console.error("[EmailService] BREVO_API_KEY missing");
      throw new Error("BREVO_API_KEY missing");
    }
    if (!EMAIL_FROM) {
      console.error("[EmailService] EMAIL_FROM missing");
      throw new Error("EMAIL_FROM missing");
    }
    apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      BREVO_API_KEY
    );
    initialized = true;
    console.log("[EmailService] Brevo initialized");
  } catch (e) {
    console.error("[EmailService] Init failed:", e);
  }
}

async function sendEmail({ subject, html, to }) {
  if (!initialized || !apiInstance) {
    try {
      initEmailService();
    } catch (e) {
      return { ok: false, error: e?.message || "Initialization error" };
    }
    if (!apiInstance) {
      return { ok: false, error: "Email service not initialized" };
    }
  }
  const EMAIL_FROM = process.env.EMAIL_FROM;
  try {
    const payload = {
      sender: { email: EMAIL_FROM },
      to: to.map(email => ({ email })),
      subject,
      htmlContent: html
    };
    const response = await apiInstance.sendTransacEmail(payload);
    return { ok: true, id: response?.messageId || response?.message || "OK" };
  } catch (e) {
    console.error("[EmailService] Send failed:", e);
    if (e?.response?.body) console.error("[EmailService] API body:", e.response.body);
    return { ok: false, error: e?.message || "Unknown error" };
  }
}

async function sendAdminOTP(email, otp) {
  console.log(`Sending OTP to ${email}`);
  const subject = "Admin OTP Verification";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#0A1F44; border-bottom: 2px solid #eee; padding-bottom: 10px;">Admin OTP Verification</h2>
      <p>Use the following OTP to verify your login:</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:2px">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <div style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
        Sent via VSKK System (Brevo API)
      </div>
    </div>
  `;
  const result = await sendEmail({ subject, html: htmlContent, to: [email] });
  if (result.ok) console.log("OTP email sent successfully");
  return result;
}

function wrapHtml(title, body) {
  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h2 { color: #333; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${body}
      </body>
    </html>
  `;
}

function table(headers, rows) {
  const headerHtml = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const rowsHtml = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${headerHtml}</thead><tbody>${rowsHtml}</tbody></table>`;
}

module.exports = {
  initEmailService,
  sendEmail,
  sendAdminOTP,
  wrapHtml,
  table
};
