const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const Candidate = require('../models/Candidate');
const EmployerContact = require('../models/EmployerContact');
const EmployerSubmission = require('../models/EmployerSubmission');
const Job = require('../models/Job');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [auth, requireRole('admin')];

const uploadDir = path.join(__dirname, '..', 'uploads', 'cvs');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^\w.-]+/g, '_');
    cb(null, `${Date.now()}-${safeBase}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only PDF or Word CV files are allowed'));
    cb(null, true);
  }
});

function mailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
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

const categoryList = value =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const statuses = [
  'new',
  'in_progress',
  'contacted',
  'phone_call_done',
  'front_interview_done',
  'ready_to_send',
  'sent_to_employer',
  'waiting_employer',
  'sent_to_interview',
  'accepted',
  'started_working',
  'talent_pool',
  'not_relevant'
];

router.get('/public/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true, status: { $ne: 'closed' } })
      .sort({ createdAt: -1 })
      .select('title area address hourlyRate profession category jobType days hours requirements description benefits employerName contactPerson status createdAt');
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load jobs' });
  }
});

router.post('/public/apply', upload.single('cv'), async (req, res) => {
  try {
    const {
      jobId,
      fullName,
      phone,
      email,
      city,
      area,
      experience,
      availability,
      salaryExpectations,
      message,
      consentToStore
    } = req.body;

    if (!fullName || !phone || !jobId) {
      return res.status(400).json({ error: 'Full name, phone, and job are required' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const categories = Array.from(new Set([
      job.category || job.profession,
      ...categoryList(req.body.categories)
    ].filter(Boolean)));

    const cv = req.file ? {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      url: `/uploads/cvs/${req.file.filename}`,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date()
    } : {};

    let candidate = await Candidate.findOne({
      $or: [
        { phone: phone.trim() },
        ...(email ? [{ email: email.trim().toLowerCase() }] : [])
      ]
    });

    const application = {
      job: job._id,
      jobTitle: job.title,
      category: job.category || job.profession,
      message: message || '',
      status: 'new'
    };

    if (!candidate) {
      candidate = new Candidate({
        fullName,
        phone,
        email,
        city,
        area,
        experience,
        availability,
        salaryExpectations,
        categories,
        consentToStore: consentToStore === 'true' || consentToStore === 'on',
        cv,
        applications: [application],
        notes: message ? [{ type: 'general', text: `Candidate message: ${message}` }] : []
      });
    } else {
      candidate.fullName = fullName || candidate.fullName;
      candidate.email = email || candidate.email;
      candidate.city = city || candidate.city;
      candidate.area = area || candidate.area;
      candidate.experience = experience || candidate.experience;
      candidate.availability = availability || candidate.availability;
      candidate.salaryExpectations = salaryExpectations || candidate.salaryExpectations;
      candidate.categories = Array.from(new Set([...(candidate.categories || []), ...categories]));
      candidate.consentToStore = candidate.consentToStore || consentToStore === 'true' || consentToStore === 'on';
      if (req.file) candidate.cv = cv;
      candidate.applications.push(application);
      if (message) candidate.notes.push({ type: 'general', text: `Candidate message: ${message}` });
    }

    await candidate.save();

    await sendMail({
      to: process.env.ADMIN_EMAIL || 'lkapuna@gmail.com',
      subject: `New candidate for ${job.title}`,
      text: [
        `New application for: ${job.title}`,
        '',
        `Name: ${candidate.fullName}`,
        `Phone: ${candidate.phone}`,
        `Email: ${candidate.email || '-'}`,
        `Area: ${candidate.area || candidate.city || '-'}`,
        `Categories: ${(candidate.categories || []).join(', ') || '-'}`,
        `Availability: ${candidate.availability || '-'}`,
        `Experience: ${candidate.experience || '-'}`,
        `Message: ${message || '-'}`,
        `CV: ${candidate.cv?.url || 'Not attached'}`
      ].join('\n'),
      attachments: req.file ? [{ filename: req.file.originalname, path: req.file.path }] : []
    });

    res.status(201).json({ message: 'Application received', candidateId: candidate._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not submit application' });
  }
});

router.get('/admin/candidates', ...adminOnly, async (req, res) => {
  try {
    const { q, status, category, area } = req.query;
    const filter = {};
    const and = [];

    if (status) filter.status = status;
    if (category) filter.categories = category;
    if (area) and.push({ $or: [{ area: new RegExp(area, 'i') }, { city: new RegExp(area, 'i') }] });
    if (q) {
      and.push({
        $or: [
          { fullName: new RegExp(q, 'i') },
          { phone: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') }
        ]
      });
    }
    if (and.length) filter.$and = and;

    const candidates = await Candidate.find(filter)
      .populate('applications.job', 'title area category profession')
      .sort({ updatedAt: -1 })
      .limit(500);

    res.json(candidates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load candidates' });
  }
});

router.get('/admin/candidates/:id', ...adminOnly, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .populate('applications.job', 'title area category profession');
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: 'Could not load candidate' });
  }
});

router.patch('/admin/candidates/:id', ...adminOnly, async (req, res) => {
  try {
    const allowed = [
      'fullName', 'phone', 'email', 'city', 'area', 'experience', 'availability',
      'salaryExpectations', 'categories', 'priority', 'status', 'startedWorkingAt',
      'contactPerson', 'lastContactedAt'
    ];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) patch[key] = req.body[key];
    }
    if (typeof patch.categories === 'string') patch.categories = categoryList(patch.categories);
    if (patch.startedWorkingAt === '') patch.startedWorkingAt = null;
    patch.updatedAt = new Date();

    const candidate = await Candidate.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update candidate' });
  }
});

router.post('/admin/candidates/:id/notes', ...adminOnly, async (req, res) => {
  try {
    const { type, text, interviewer } = req.body;
    if (!text) return res.status(400).json({ error: 'Note text is required' });
    if (type && !['general', 'phone_call', 'front_interview', 'internal', 'shareable'].includes(type)) {
      return res.status(400).json({ error: 'Invalid note type' });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    candidate.notes.push({ type, text, interviewer, createdBy: req.user._id });
    if (type === 'phone_call') candidate.status = 'phone_call_done';
    if (type === 'front_interview') candidate.status = 'front_interview_done';
    candidate.lastContactedAt = new Date();
    await candidate.save();

    res.status(201).json(candidate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add note' });
  }
});

router.get('/admin/employers', ...adminOnly, async (req, res) => {
  try {
    const employers = await EmployerContact.find().sort({ updatedAt: -1 });
    res.json(employers);
  } catch (err) {
    res.status(500).json({ error: 'Could not load employers' });
  }
});

router.post('/admin/employers', ...adminOnly, async (req, res) => {
  try {
    const employer = new EmployerContact(req.body);
    await employer.save();
    res.status(201).json(employer);
  } catch (err) {
    res.status(500).json({ error: 'Could not save employer' });
  }
});

router.patch('/admin/employers/:id', ...adminOnly, async (req, res) => {
  try {
    const employer = await EmployerContact.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!employer) return res.status(404).json({ error: 'Employer not found' });
    res.json(employer);
  } catch (err) {
    res.status(500).json({ error: 'Could not update employer' });
  }
});

router.post('/admin/jobs', ...adminOnly, async (req, res) => {
  try {
    const job = new Job({
      ...req.body,
      profession: req.body.profession || req.body.category,
      category: req.body.category || req.body.profession,
      status: req.body.status || 'open',
      isActive: req.body.status ? req.body.status !== 'closed' : true
    });
    await job.save();
    res.status(201).json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create job' });
  }
});

router.get('/admin/submissions', ...adminOnly, async (req, res) => {
  try {
    const submissions = await EmployerSubmission.find()
      .populate('candidate', 'fullName phone categories status')
      .populate('employerContact', 'businessName contactName email')
      .sort({ sentAt: -1 })
      .limit(300);
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Could not load submissions' });
  }
});

router.post('/admin/candidates/:id/send-to-employer', ...adminOnly, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const employer = req.body.employerContact
      ? await EmployerContact.findById(req.body.employerContact)
      : null;

    const employerEmail = req.body.employerEmail || employer?.email;
    const employerName = req.body.employerName || employer?.businessName || '';
    if (!employerEmail) return res.status(400).json({ error: 'Employer email is required' });

    const shareableTypes = [];
    if (req.body.includePhoneNotes !== false) shareableTypes.push('phone_call');
    if (req.body.includeInterviewNotes !== false) shareableTypes.push('front_interview');
    if (req.body.includeShareableNotes !== false) shareableTypes.push('shareable');

    const notes = (candidate.notes || [])
      .filter(note => shareableTypes.includes(note.type))
      .map(note => `- ${note.type}: ${note.text}`)
      .join('\n');

    await sendMail({
      to: employerEmail,
      subject: `Candidate details: ${candidate.fullName}`,
      text: [
        req.body.message || 'Hello, sending candidate details for your review.',
        '',
        `Candidate: ${candidate.fullName}`,
        `Phone: ${candidate.phone}`,
        `Email: ${candidate.email || '-'}`,
        `Area: ${candidate.area || candidate.city || '-'}`,
        `Categories: ${(candidate.categories || []).join(', ') || '-'}`,
        `Availability: ${candidate.availability || '-'}`,
        `Experience: ${candidate.experience || '-'}`,
        '',
        notes ? `Interviewer notes:\n${notes}` : 'No shareable interviewer notes were selected.'
      ].join('\n'),
      attachments: req.body.includeCv !== false && candidate.cv?.path
        ? [{ filename: candidate.cv.originalName || 'candidate-cv', path: candidate.cv.path }]
        : []
    });

    const submission = new EmployerSubmission({
      candidate: candidate._id,
      employerContact: employer?._id,
      employerName,
      employerEmail,
      job: req.body.job || undefined,
      jobTitle: req.body.jobTitle || '',
      includeCv: req.body.includeCv !== false,
      includePhoneNotes: req.body.includePhoneNotes !== false,
      includeInterviewNotes: req.body.includeInterviewNotes !== false,
      includeShareableNotes: req.body.includeShareableNotes !== false,
      message: req.body.message || '',
      sentBy: req.user._id
    });
    await submission.save();

    candidate.status = 'sent_to_employer';
    candidate.notes.push({
      type: 'internal',
      text: `Sent to employer ${employerName || employerEmail}`,
      createdBy: req.user._id
    });
    await candidate.save();

    res.status(201).json({ message: 'Candidate sent to employer', submission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not send candidate' });
  }
});

router.get('/admin/statuses', ...adminOnly, (req, res) => {
  res.json(statuses);
});

module.exports = router;
