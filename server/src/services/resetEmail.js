const nodemailer = require("nodemailer");
function mailConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.MAIL_FROM &&
    process.env.PUBLIC_APP_URL
  );
}
async function sendResetEmail(email, token) {
  const url = new URL("/reset-password", process.env.PUBLIC_APP_URL);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("Production reset links require HTTPS.");
  url.searchParams.set("token", token);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
  const result = await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Reset your MT Nexus Global password",
    text: `A password reset was requested for your account. Open this link within one hour:\n\n${url.href}\n\nIf you did not request this, ignore this email.`,
  });
  if (!result.accepted?.length)
    throw new Error("Mail delivery was not accepted.");
}
module.exports = { mailConfigured, sendResetEmail };
