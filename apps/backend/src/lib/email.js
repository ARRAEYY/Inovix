/**
 * Email service — Nodemailer + Gmail SMTP.
 *
 * Sends transactional emails (password reset OTP, etc.).
 * In development mode (NODE_ENV !== 'production'), emails are logged
 * to the console instead of actually sending — so you can test without
 * real SMTP credentials.
 *
 * In production, set the Gmail SMTP env vars:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your-gmail@gmail.com
 *   SMTP_PASS=your-16-char-app-password  (Google Account → Security → App passwords)
 *   SMTP_FROM="Campus Food <your-gmail@gmail.com>"
 *
 * Gmail app password setup:
 *   1. Go to https://myaccount.google.com/security
 *   2. Enable 2-Step Verification (required for app passwords)
 *   3. Go to "App passwords" → create a new one for "Mail"
 *   4. Copy the 16-char password → set as SMTP_PASS
 */

const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Get (or lazily create) the Nodemailer transporter.
 * Returns null if SMTP env vars aren't configured.
 */
function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // Not configured — caller should fall back to console.log
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465, // true for 465, false for 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Check if SMTP is configured.
 */
function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send an email. In dev mode (no SMTP configured), logs to console.
 *
 * @param {Object} opts
 * @param {string} opts.to — recipient email
 * @param {string} opts.subject — email subject
 * @param {string} opts.text — plain text body
 * @param {string} [opts.html] — optional HTML body
 * @returns {Promise<{sent: boolean, preview?: string, dev: boolean}>}
 */
async function sendEmail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'Campus Food <noreply@campus.food>';

  // Dev mode: no SMTP configured → log to console
  if (!isEmailConfigured()) {
    console.log('\n─────────────────────────────────────────');
    console.log('📧 EMAIL (dev mode — not actually sent)');
    console.log(`  To:      ${to}`);
    console.log(`  From:    ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:    ${text}`);
    console.log('─────────────────────────────────────────\n');
    return { sent: false, dev: true };
  }

  // Prod mode: send via SMTP
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`[email] Sent to ${to}: ${subject} (messageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId, dev: false };
  } catch (err) {
    console.error('[email] Failed to send:', err.message);
    // Fall back to console log so the flow doesn't break
    console.log('\n📧 EMAIL (SMTP failed — logging instead)');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:    ${text}`);
    console.log('');
    return { sent: false, error: err.message, dev: true };
  }
}

/**
 * Send a password reset OTP email.
 *
 * @param {string} to — recipient email
 * @param {string} otp — 6-digit OTP code
 * @param {string} name — user's name (optional, for personalization)
 */
async function sendPasswordResetOTP(to, otp, name = '') {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const text = `${greeting}

You requested a password reset for your Campus Food account.

Your verification code is: ${otp}

This code expires in 10 minutes. If you didn't request this reset, you can safely ignore this email.

— Campus Food Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
      <h2 style="color: #b10035;">Campus Food — Password Reset</h2>
      <p>${greeting}</p>
      <p>You requested a password reset for your Campus Food account.</p>
      <div style="text-align: center; margin: 2rem 0;">
        <span style="font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; color: #b10035; background: #fff5f7; padding: 1rem 2rem; border-radius: 8px; border: 2px dashed #b10035;">
          ${otp}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 0.875rem;">This code expires in 10 minutes. If you didn't request this reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 1.5rem 0;">
      <p style="color: #9ca3af; font-size: 0.75rem;">— Campus Food Team</p>
    </div>`;

  return sendEmail({ to, subject: 'Campus Food — Password Reset Code', text, html });
}

module.exports = {
  sendEmail,
  sendPasswordResetOTP,
  isEmailConfigured,
};
