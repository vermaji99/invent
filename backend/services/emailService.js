const SibApiV3Sdk = require("@sendinblue/client");

const EMAIL_FROM = process.env.EMAIL_FROM;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

console.log("[EmailService] Brevo API initialized");

async function sendAdminOTP(email, otp) {
  try {
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

    const payload = {
      sender: { email: EMAIL_FROM },
      to: [{ email }],
      subject,
      htmlContent
    };

    const response = await apiInstance.sendTransacEmail(payload);
    console.log("[EmailService] Email sent:", response);
    return { ok: true, id: response?.messageId || response?.message || "OK" };
  } catch (e) {
    console.error("[EmailService] Send failed:", e);
    return { ok: false, error: e?.message || "Unknown error" };
  }
}

module.exports = {
  sendAdminOTP
};
