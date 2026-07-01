const fs = require('fs');
const nodemailer = require('nodemailer');

function smtpTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function splitRecipients(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function resendAttachments(attachments = []) {
  return attachments
    .filter(file => file?.path || file?.content)
    .map(file => ({
      filename: file.filename || 'attachment',
      content: file.content || fs.readFileSync(file.path).toString('base64')
    }));
}

async function sendWithResend(options) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not configured. Email skipped:', options.subject);
    return { skipped: true, provider: 'resend', error: 'RESEND_API_KEY is missing' };
  }

  const payload = {
    from: process.env.MAIL_FROM || 'onboarding@resend.dev',
    to: splitRecipients(options.to),
    cc: splitRecipients(options.cc),
    bcc: splitRecipients(options.bcc),
    reply_to: options.replyTo || process.env.MAIL_REPLY_TO || undefined,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  const attachments = resendAttachments(options.attachments);
  if (attachments.length) payload.attachments = attachments;
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || `Resend API error ${response.status}`;
    const error = new Error(message);
    error.code = `RESEND_${response.status}`;
    error.details = data;
    throw error;
  }
  return { provider: 'resend', id: data.id };
}

async function sendWithSmtp(options) {
  const transport = smtpTransport();
  if (!transport) {
    console.warn('SMTP is not configured. Email skipped:', options.subject);
    return { skipped: true, provider: 'smtp', error: 'SMTP is not configured' };
  }
  return transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    ...options
  });
}

async function sendMail(options) {
  const provider = String(process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (provider === 'smtp') return sendWithSmtp(options);
  if (provider === 'resend' || (!provider && process.env.RESEND_API_KEY)) {
    return sendWithResend(options);
  }
  return sendWithSmtp(options);
}

async function sendMailWithTimeout(options, timeoutMs = 10000) {
  const result = await Promise.race([
    sendMail(options).catch(error => ({
      skipped: true,
      error: error.message || 'Email failed',
      code: error.code || '',
      details: error.details || undefined
    })),
    new Promise(resolve => {
      setTimeout(() => {
        resolve({ skipped: true, timeout: true, error: 'Email connection timeout' });
      }, timeoutMs);
    })
  ]);
  if (result?.error) console.error('Email delivery failed:', result);
  return result;
}

module.exports = { sendMailWithTimeout };
