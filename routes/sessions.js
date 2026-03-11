const express = require('express');
const router = express.Router();
const WorkSession = require('../models/WorkSession');
const { auth, requireRole } = require('../middleware/auth');

// POST /api/sessions/start - התחלת עבודה
router.post('/start', auth, requireRole('worker'), async (req, res) => {
  try {
    const active = await WorkSession.findOne({ worker: req.user._id, status: 'active' });
    if (active) return res.status(400).json({ error: 'כבר יש משמרת פעילה' });

    const session = new WorkSession({
      worker: req.user._id,
      employer: req.body.employerId,
      job: req.body.jobId,
      hourlyRate: req.body.hourlyRate,
      startTime: new Date(),
      startLocation: req.body.location
    });

    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בהתחלת משמרת' });
  }
});

// POST /api/sessions/end - סיום עבודה
router.post('/end', auth, requireRole('worker'), async (req, res) => {
  try {
    const session = await WorkSession.findOne({ worker: req.user._id, status: 'active' });
    if (!session) return res.status(404).json({ error: 'אין משמרת פעילה' });

    session.endTime = new Date();
    session.status = 'pending_approval';
    await session.save();

    res.json({
      session,
      summary: {
        totalHours: session.totalHours,
        grossPay: session.grossPay,
        fee: session.workerFee,
        netPay: session.netWorkerPay
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בסיום משמרת' });
  }
});

// GET /api/sessions/my - היסטוריה של עובד
router.get('/my', auth, requireRole('worker'), async (req, res) => {
  try {
    const sessions = await WorkSession.find({ worker: req.user._id })
      .populate('employer', 'businessName')
      .populate('job', 'title')
      .sort({ date: -1 });

    const totalHours = sessions.reduce((sum, s) => sum + s.totalHours, 0);
    const totalEarned = sessions.reduce((sum, s) => sum + s.netWorkerPay, 0);

    res.json({ sessions, totalHours, totalEarned });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת משמרות' });
  }
});

// GET /api/sessions/employer - משמרות לאישור מעסיק
router.get('/employer', auth, requireRole('employer'), async (req, res) => {
  try {
    const sessions = await WorkSession.find({
      employer: req.user._id,
      status: 'pending_approval'
    }).populate('worker', 'firstName lastName');

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// PATCH /api/sessions/:id/approve - אישור מעסיק
router.patch('/:id/approve', auth, requireRole('employer'), async (req, res) => {
  try {
    const session = await WorkSession.findOne({ _id: req.params.id, employer: req.user._id });
    if (!session) return res.status(404).json({ error: 'משמרת לא נמצאה' });

    const { action, correctedHours, disputeReason } = req.body;

    if (action === 'approve') {
      session.status = 'approved';
      session.employerApproved = true;
    } else if (action === 'correct') {
      session.employerCorrectedHours = correctedHours;
      session.status = 'corrected';
    } else if (action === 'dispute') {
      session.disputeReason = disputeReason;
      session.status = 'disputed';
    }

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

module.exports = router;

// GET /api/sessions/employer/history - כל המשמרות של המעסיק
router.get('/employer/history', auth, requireRole('employer'), async (req, res) => {
  try {
    const sessions = await WorkSession.find({ employer: req.user._id })
      .populate('worker', 'firstName lastName')
      .sort({ date: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});
