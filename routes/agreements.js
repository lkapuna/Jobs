const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PlacementAgreement = require('../models/PlacementAgreement');
const EmployerContact = require('../models/EmployerContact');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [auth, requireRole('admin')];

function mailTransport() {
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

async function sendMail(options) {
  const transport = mailTransport();
  if (!transport) {
    console.warn('SMTP is not configured. Email skipped:', options.subject);
    return { skipped: true };
  }
  return transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    ...options
  });
}

async function sendMailWithTimeout(options, timeoutMs = 10000) {
  return Promise.race([
    sendMail(options),
    new Promise(resolve => {
      setTimeout(() => {
        resolve({ skipped: true, timeout: true, error: 'Email connection timeout' });
      }, timeoutMs);
    })
  ]);
}

function appBaseUrl(req) {
  return process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
}

function agreementText(agreement) {
  const fee = Number(agreement.placementFee || 0).toLocaleString('he-IL');
  return [
    'הסכם השמה והתחייבות לתשלום',
    'א.ש פרימיום - מחלקת השמה',
    '',
    `עסק: ${agreement.businessName || '-'}`,
    `ח.פ: ${agreement.businessId || '-'}`,
    `כתובת: ${agreement.businessAddress || '-'}`,
    `איש קשר: ${agreement.contactName || '-'}`,
    `טלפון: ${agreement.contactPhone || '-'}`,
    '',
    `מועמד: ${agreement.candidateName || '-'}`,
    `תעודת זהות: ${agreement.candidateIdentityNumber || '-'}`,
    `תפקיד: ${agreement.candidateRole || agreement.jobTitle || '-'}`,
    '',
    'העסק מאשר כי פרטי המועמד נמסרו לו על ידי א.ש פרימיום לצורך בחינת העסקתו.',
    `דמי השמה: ₪${fee} + מע"מ ${agreement.vatPercent || 0}%`,
    'התשלום יתבצע במועד המוקדם מבין: לאחר 30 ימי עבודה או לאחר קבלת תלוש שכר ראשון.',
    '',
    'העסק מתחייב לעדכן על תחילת העבודה, לא להעביר את פרטי המועמד לצד שלישי, ולשלם את דמי ההשמה בהתאם להסכם.',
    'אם המועמד יועסק אצל העסק או גורם קשור במהלך 12 חודשים ממועד שליחת פרטיו, ייחשב הדבר כהשמה שבוצעה באמצעות א.ש פרימיום.',
    'אם המועמד יסיים את עבודתו בתוך 14 ימים מתחילת עבודתו, ובנסיבות שאינן קשורות לעסק, א.ש פרימיום תאתר מועמד חלופי ללא עלות נוספת.'
  ].join('\n');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function signedAgreementText(agreement) {
  return [
    agreementText(agreement),
    '',
    'פרטי חתימה דיגיטלית',
    `שם החותם: ${agreement.signerName || '-'}`,
    `תפקיד: ${agreement.signerRole || '-'}`,
    `טלפון: ${agreement.signerPhone || '-'}`,
    `אימייל: ${agreement.signerEmail || '-'}`,
    `תאריך חתימה: ${agreement.signedAt ? agreement.signedAt.toLocaleString('he-IL') : '-'}`,
    `Signature ID: ${agreement.signatureId || '-'}`,
    `IP: ${agreement.signatureIp || '-'}`,
    `Browser: ${agreement.signatureBrowser || '-'}`
  ].join('\n');
}

function signedAgreementHtml(agreement) {
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;color:#111;line-height:1.7">
      <h2>הסכם השמה חתום</h2>
      <pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(signedAgreementText(agreement))}</pre>
      ${agreement.signatureDataUrl ? `<h3>חתימה</h3><img src="${escapeHtml(agreement.signatureDataUrl)}" alt="חתימה" style="max-width:360px;border:1px solid #ddd;padding:10px">` : ''}
    </div>
  `;
}

router.get('/admin/stats', ...adminOnly, async (req, res) => {
  try {
    const [sent, signed, waitingPayment, paid, all] = await Promise.all([
      PlacementAgreement.countDocuments({ status: { $in: ['sent', 'viewed'] } }),
      PlacementAgreement.countDocuments({ status: 'signed' }),
      PlacementAgreement.countDocuments({ status: 'waiting_payment' }),
      PlacementAgreement.countDocuments({ status: 'paid' }),
      PlacementAgreement.find()
    ]);

    const totalRevenue = all.filter(a => a.status === 'paid').reduce((sum, a) => sum + (a.paidAmount || a.placementFee || 0), 0);
    const openCollection = all.filter(a => a.status === 'waiting_payment').reduce((sum, a) => sum + (a.placementFee || 0), 0);
    res.json({ sent, signed, waitingPayment, paid, totalRevenue, openCollection });
  } catch (err) {
    res.status(500).json({ error: 'Could not load agreement stats' });
  }
});

router.get('/admin', ...adminOnly, async (req, res) => {
  try {
    const { q, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { businessName: new RegExp(q, 'i') },
        { candidateName: new RegExp(q, 'i') },
        { candidatePhone: new RegExp(q, 'i') },
        { jobTitle: new RegExp(q, 'i') }
      ];
    }
    const agreements = await PlacementAgreement.find(filter)
      .populate('candidate', 'fullName phone status')
      .populate('employerContact', 'businessName contactName email')
      .sort({ updatedAt: -1 })
      .limit(500);
    res.json(agreements);
  } catch (err) {
    res.status(500).json({ error: 'Could not load agreements' });
  }
});

router.post('/admin', ...adminOnly, async (req, res) => {
  try {
    const [employer, candidate, job] = await Promise.all([
      req.body.employerContact ? EmployerContact.findById(req.body.employerContact) : null,
      req.body.candidate ? Candidate.findById(req.body.candidate) : null,
      req.body.job ? Job.findById(req.body.job) : null
    ]);

    const agreement = new PlacementAgreement({
      employerContact: employer?._id,
      candidate: candidate?._id,
      job: job?._id,
      businessName: req.body.businessName || employer?.businessName || '',
      businessId: req.body.businessId || '',
      businessAddress: req.body.businessAddress || '',
      contactName: req.body.contactName || employer?.contactName || '',
      contactPhone: req.body.contactPhone || employer?.phone || '',
      contactEmail: req.body.contactEmail || employer?.email || '',
      candidateName: req.body.candidateName || candidate?.fullName || '',
      candidatePhone: req.body.candidatePhone || candidate?.phone || '',
      candidateIdentityNumber: req.body.candidateIdentityNumber || candidate?.identityNumber || '',
      candidateRole: req.body.candidateRole || job?.title || '',
      candidateNumber: candidate?._id?.toString() || '',
      jobTitle: req.body.jobTitle || job?.title || '',
      placementFee: Number(req.body.placementFee || 0),
      vatPercent: Number(req.body.vatPercent || 18),
      notes: req.body.notes || '',
      createdBy: req.user._id
    });
    await agreement.save();
    res.status(201).json(agreement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create agreement' });
  }
});

router.patch('/admin/:id', ...adminOnly, async (req, res) => {
  try {
    const allowed = ['status', 'placementFee', 'vatPercent', 'notes', 'businessId', 'businessAddress', 'jobTitle'];
    const patch = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body, key)) patch[key] = req.body[key];
    const agreement = await PlacementAgreement.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
    res.json(agreement);
  } catch (err) {
    res.status(500).json({ error: 'Could not update agreement' });
  }
});

router.post('/admin/:id/send', ...adminOnly, async (req, res) => {
  try {
    const agreement = await PlacementAgreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
    if (!agreement.contactEmail) return res.status(400).json({ error: 'Employer email is missing' });

    agreement.status = 'sent';
    agreement.sentAt = new Date();
    await agreement.save();

    const link = `${appBaseUrl(req)}/pages/sign-agreement.html?token=${agreement.token}`;
    const mailResult = await sendMailWithTimeout({
      to: agreement.contactEmail,
      replyTo: process.env.MAIL_REPLY_TO || process.env.SMTP_USER,
      subject: `הסכם השמה לחתימה - ${agreement.candidateName || agreement.jobTitle}`,
      text: [
        'שלום,',
        'מצורף קישור לחתימה דיגיטלית על הסכם השמה.',
        link,
        '',
        agreementText(agreement)
      ].join('\n')
    });

    res.json({
      message: mailResult?.timeout ? 'Email timed out' : mailResult?.skipped ? 'SMTP is not configured' : 'Agreement sent',
      link,
      skipped: !!mailResult?.skipped,
      timeout: !!mailResult?.timeout,
      emailError: mailResult?.error || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not send agreement' });
  }
});

router.post('/admin/:id/started-work', ...adminOnly, async (req, res) => {
  try {
    const startedWorkingAt = req.body.startedWorkingAt ? new Date(req.body.startedWorkingAt) : new Date();
    const paymentDueAt = new Date(startedWorkingAt);
    paymentDueAt.setDate(paymentDueAt.getDate() + 30);
    const agreement = await PlacementAgreement.findByIdAndUpdate(req.params.id, {
      status: 'waiting_payment',
      startedWorkingAt,
      paymentDueAt
    }, { new: true });
    res.json(agreement);
  } catch (err) {
    res.status(500).json({ error: 'Could not mark started work' });
  }
});

router.post('/admin/:id/send-signed', ...adminOnly, async (req, res) => {
  try {
    const agreement = await PlacementAgreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
    if (agreement.status !== 'signed' && !agreement.signedAt) return res.status(400).json({ error: 'Agreement is not signed yet' });

    const to = req.body.email || agreement.contactEmail;
    if (!to) return res.status(400).json({ error: 'Recipient email is missing' });

    const mailResult = await sendMailWithTimeout({
      to,
      replyTo: process.env.MAIL_REPLY_TO || process.env.SMTP_USER,
      subject: `הסכם השמה חתום - ${agreement.candidateName || agreement.jobTitle || agreement.businessName}`,
      text: signedAgreementText(agreement),
      html: signedAgreementHtml(agreement)
    });

    res.json({
      message: mailResult?.timeout ? 'Email timed out' : mailResult?.skipped ? 'SMTP is not configured' : 'Signed agreement sent',
      skipped: !!mailResult?.skipped,
      timeout: !!mailResult?.timeout,
      emailError: mailResult?.error || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not send signed agreement' });
  }
});

router.post('/admin/:id/paid', ...adminOnly, async (req, res) => {
  try {
    const agreement = await PlacementAgreement.findByIdAndUpdate(req.params.id, {
      status: 'paid',
      paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
      paidAmount: Number(req.body.paidAmount || 0),
      paymentMethod: req.body.paymentMethod || '',
      invoiceNumber: req.body.invoiceNumber || ''
    }, { new: true });
    res.json(agreement);
  } catch (err) {
    res.status(500).json({ error: 'Could not mark paid' });
  }
});

router.get('/public/:token', async (req, res) => {
  try {
    const agreement = await PlacementAgreement.findOne({ token: req.params.token });
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
    if (agreement.status === 'sent') {
      agreement.status = 'viewed';
      agreement.viewedAt = new Date();
      await agreement.save();
    }
    res.json({ agreement, agreementText: agreementText(agreement) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load agreement' });
  }
});

router.post('/public/:token/sign', async (req, res) => {
  try {
    const agreement = await PlacementAgreement.findOne({ token: req.params.token });
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
    if (agreement.status === 'signed') return res.status(400).json({ error: 'Agreement already signed' });

    agreement.status = 'signed';
    agreement.signerName = req.body.signerName || '';
    agreement.signerRole = req.body.signerRole || '';
    agreement.signerPhone = req.body.signerPhone || '';
    agreement.signerEmail = req.body.signerEmail || agreement.contactEmail || '';
    agreement.signatureDataUrl = req.body.signatureDataUrl || '';
    agreement.signatureId = crypto.randomBytes(12).toString('hex');
    agreement.signatureIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
    agreement.signatureBrowser = req.headers['user-agent'] || '';
    agreement.signatureDevice = req.body.device || '';
    agreement.signedAt = new Date();
    await agreement.save();

    const text = [
      'הסכם השמה נחתם דיגיטלית.',
      '',
      agreementText(agreement),
      '',
      `שם החותם: ${agreement.signerName}`,
      `תפקיד: ${agreement.signerRole}`,
      `טלפון: ${agreement.signerPhone}`,
      `אימייל: ${agreement.signerEmail}`,
      `Signature ID: ${agreement.signatureId}`,
      `IP: ${agreement.signatureIp}`,
      `Browser: ${agreement.signatureBrowser}`
    ].join('\n');

    const emailResults = { employerSent: false, adminSent: false, errors: [] };
    try {
      const employerMail = await sendMailWithTimeout({ to: agreement.contactEmail, subject: `הסכם חתום - ${agreement.candidateName}`, text });
      emailResults.employerSent = !employerMail?.skipped;
      if (employerMail?.timeout) emailResults.errors.push('Employer email: connection timeout');
    } catch (mailErr) {
      emailResults.errors.push(`Employer email: ${mailErr.message}`);
      console.error('Signed agreement employer email failed:', mailErr);
    }
    try {
      const adminMail = await sendMailWithTimeout({ to: process.env.ADMIN_EMAIL || 'alef.shin.jobs@gmail.com', subject: `הסכם חתום - ${agreement.candidateName}`, text });
      emailResults.adminSent = !adminMail?.skipped;
      if (adminMail?.timeout) emailResults.errors.push('Admin email: connection timeout');
    } catch (mailErr) {
      emailResults.errors.push(`Admin email: ${mailErr.message}`);
      console.error('Signed agreement admin email failed:', mailErr);
    }

    res.json({ message: 'Agreement signed', agreement, emailResults });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not sign agreement' });
  }
});

module.exports = router;
