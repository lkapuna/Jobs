const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/jobs - חיפוש משרות (לעובדים)
router.get('/', auth, async (req, res) => {
  try {
    const { area, profession, jobType, minRate, maxRate } = req.query;
    const filter = { isActive: true };

    if (area) filter.area = new RegExp(area, 'i');
    if (profession) filter.profession = new RegExp(profession, 'i');
    if (jobType) filter.jobType = jobType;
    if (minRate || maxRate) {
      filter.hourlyRate = {};
      if (minRate) filter.hourlyRate.$gte = Number(minRate);
      if (maxRate) filter.hourlyRate.$lte = Number(maxRate);
    }

    const jobs = await Job.find(filter)
      .populate('employer', 'businessName area rating')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת משרות' });
  }
});

// POST /api/jobs - פרסום משרה (מעסיקים)
router.post('/', auth, requireRole('employer'), async (req, res) => {
  try {
    const job = new Job({ ...req.body, employer: req.user._id });
    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בפרסום משרה' });
  }
});

// POST /api/jobs/:id/apply - פנייה למשרה (עובדים)
router.post('/:id/apply', auth, requireRole('worker'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'משרה לא נמצאה' });

    const alreadyApplied = job.applicants.find(
      a => a.worker.toString() === req.user._id.toString()
    );
    if (alreadyApplied) return res.status(400).json({ error: 'כבר פנית למשרה זו' });

    job.applicants.push({
      worker: req.user._id,
      message: req.body.message || ''
    });
    await job.save();

    res.json({ message: 'הפנייה נשלחה בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשליחת פנייה' });
  }
});

// GET /api/jobs/my - משרות של המעסיק
router.get('/my', auth, requireRole('employer'), async (req, res) => {
  try {
    const jobs = await Job.find({ employer: req.user._id })
      .populate('applicants.worker', 'firstName lastName profession area rating')
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת משרות' });
  }
});

// PATCH /api/jobs/:jobId/applicants/:workerId - עדכון סטטוס מועמד
router.patch('/:jobId/applicants/:workerId', auth, requireRole('employer'), async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, employer: req.user._id });
    if (!job) return res.status(404).json({ error: 'משרה לא נמצאה' });

    const applicant = job.applicants.find(
      a => a.worker.toString() === req.params.workerId
    );
    if (!applicant) return res.status(404).json({ error: 'מועמד לא נמצא' });

    applicant.status = req.body.status; // 'interested' | 'rejected'
    await job.save();

    res.json({ message: 'סטטוס עודכן' });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בעדכון' });
  }
});


// GET /api/jobs/my-approved - משרות שהעובד אושר בהן
router.get('/my-approved', auth, requireRole('worker'), async (req, res) => {
  try {
    const jobs = await Job.find({
      'applicants': {
        $elemMatch: {
          worker: req.user._id,
          status: 'interested'
        }
      },
      isActive: true
    }).populate('employer', 'businessName');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

module.exports = router;
