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

function mailAttachments(attachments = []) {
  return attachments
    .filter(file => file?.path || file?.content)
    .map(file => ({
      filename: file.filename || 'attachment',
      content: file.content || fs.readFileSync(file.path).toString('base64'),
      contentType: file.contentType || file.mimetype || 'application/octet-stream'
    }));
}

function encodeHeader(value) {
  if (!value) return '';
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function formatAddress(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(.*)<([^>]+)>$/);
  if (!match) return raw;
  const name = match[1].trim().replace(/^"|"$/g, '');
  const email = match[2].trim();
  return name ? `${encodeHeader(name)} <${email}>` : email;
}

function base64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64Body(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64');
}

function buildMimeMessage(options) {
  const boundary = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const from = formatAddress(process.env.MAIL_FROM || process.env.SMTP_USER || process.env.ADMIN_EMAIL);
  const to = splitRecipients(options.to)?.join(', ');
  const cc = splitRecipients(options.cc)?.join(', ');
  const bcc = splitRecipients(options.bcc)?.join(', ');
  const replyTo = options.replyTo || process.env.MAIL_REPLY_TO;
  const attachments = mailAttachments(options.attachments);
  const bodyType = options.html ? 'text/html' : 'text/plain';
  const body = options.html || options.text || '';

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    replyTo ? `Reply-To: ${formatAddress(replyTo)}` : '',
    `Subject: ${encodeHeader(options.subject || '')}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ].filter(Boolean);

  const parts = [
    ...headers,
    '',
    `--${boundary}`,
    `Content-Type: ${bodyType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(body)
  ];

  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.content
    );
  }

  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n');
}

async function gmailAccessToken() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    return { skipped: true, provider: 'gmail_api', error: 'Gmail API OAuth variables are missing' };
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || `Gmail token error ${response.status}`);
    error.code = `GMAIL_TOKEN_${response.status}`;
    error.details = data;
    throw error;
  }
  return data.access_token;
}

async function sendWithGmailApi(options) {
  const token = await gmailAccessToken();
  if (token?.skipped) return token;

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64Url(buildMimeMessage(options)) })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gmail API error ${response.status}`;
    const error = new Error(message);
    error.code = `GMAIL_API_${response.status}`;
    error.details = data;
    throw error;
  }
  return { provider: 'gmail_api', id: data.id };
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
  if (provider === 'gmail_api') return sendWithGmailApi(options);
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
