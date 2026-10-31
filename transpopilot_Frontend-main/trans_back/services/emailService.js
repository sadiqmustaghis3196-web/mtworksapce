import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

let resendInstance = null;

const getResend = () => {
  if (resendInstance) return resendInstance;

  if (!process.env.RESEND_API) {
    console.error('Email Service Error: Missing RESEND_API environment variable');
    return null;
  }

  resendInstance = new Resend(process.env.RESEND_API);
  return resendInstance;
};

export const verifyTransporter = async () => {
  const resend = getResend();
  return !!resend;
};

export const sendDriverInvitationEmail = async (invitation) => {
  const resend = getResend();
  if (!resend) {
    throw new Error('Email service is not configured (missing RESEND_API).');
  }

  const { first_name, email, token, role, employee_type } = invitation;

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.VERCEL) ||
    process.env.APP_ENV === 'production';

  let baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    if (isProduction) {
      console.error('[EmailService Configuration Error] APP_BASE_URL is not set in production. Refusing to send localhost links.');
      throw new Error('APP_BASE_URL is not configured for invitation emails.');
    } else {
      baseUrl = 'http://localhost:5173';
    }
  } else if (isProduction && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
    console.error(`[EmailService Configuration Error] APP_BASE_URL is configured as localhost in production (${baseUrl}). Refusing to send.`);
    throw new Error('APP_BASE_URL is not configured for invitation emails.');
  }

  // Strip trailing slashes to avoid double slashes and construct URL-safe accept link
  const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const invitationLink = `${cleanBaseUrl}/accept-invitation?token=${encodeURIComponent(token)}`;

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7);

  let subject = "You're invited to join TranspoPilot";
  let roleText = `a driver (${employee_type || 'employee'})`;

  if (role === 'fleet_manager') {
    subject = "You're invited as a Fleet Manager on TranspoPilot";
    roleText = "a Fleet Manager";
  } else if (role === 'dispatcher') {
    subject = "You're invited as a Dispatcher on TranspoPilot";
    roleText = "a Dispatcher";
  }

  const name = first_name && first_name.trim() ? first_name : 'Team Member';

  try {
    const { data, error } = await resend.emails.send({
      from: 'TranspoPilot <partners@transpopilotai.com>',
      to: email,
      subject: subject,
      text: `Hi ${name},\n\nYou have been invited to join TranspoPilot as ${roleText}.\n\nClick the link below to accept your invitation and complete your setup:\n${invitationLink}\n\nInvitation expires on: ${expirationDate.toLocaleDateString()}\n\nIf you did not expect this invitation, you can safely ignore this email.\n\nTranspoPilot Support`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">TranspoPilot</h2>
          <p>Hi ${name},</p>
          <p>You have been invited to join TranspoPilot as <strong>${roleText}</strong>.</p>
          <p>Click the button below to accept your invitation and complete your setup.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="word-break: break-all; font-size: 13px; color: #666;">Or copy and paste this link into your browser:<br/><a href="${invitationLink}" style="color: #2563eb;">${invitationLink}</a></p>
          <p><em>Invitation expires on: ${expirationDate.toLocaleDateString()}</em></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">If you did not expect this invitation, you can safely ignore this email.</p>
          <p style="font-size: 12px; color: #999;">TranspoPilot Support</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      throw new Error(`Email delivery failed: ${error.message}`);
    }

    console.log('Successfully sent email! Message ID:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Email Service Error Details:', error.message);
    throw new Error('Email delivery failed: ' + error.message);
  }
};
