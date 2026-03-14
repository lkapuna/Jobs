const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const WorkSession = require('../models/WorkSession');
const { auth, requireRole } = require('../middleware/auth');

const adminOnly = [auth, requireRole('admin')];

// GET /api/admin/stats - סטטיסטיקות כלליות
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [workers, employers, jobs, sessions] = await Promise.all([
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments(),
      WorkSession.find({ status: 'approved' })
    ]);

    const totalHours = sessions.reduce((sum, s) => sum + s.totalHours, 0);
    const totalRevenue = sessions.reduce((sum, s) => sum + s.workerFee + s.employerFee, 0);

    res.json({
      workers,
      employers,
      jobs,
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/admin/users - כל המשתמשים
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [
      { email: new RegExp(search, 'i') },
      { firstName: new RegExp(search, 'i') },
      { businessName: new RegExp(search, 'i') }
    ];

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// PATCH /api/admin/users/:id - עדכון פרטי משתמש
router.patch('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const { firstName, lastName, phone, businessName } = req.body;
    const update = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName  !== undefined) update.lastName  = lastName;
    if (phone     !== undefined) update.phone      = phone;
    if (businessName !== undefined) update.businessName = businessName;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בעדכון' });
  }
});

// PATCH /api/admin/users/:id/block - חסימת משתמש
router.patch('/users/:id/block', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/admin/sessions - כל המשמרות
router.get('/sessions', ...adminOnly, async (req, res) => {
  try {
    const sessions = await WorkSession.find()
      .populate('worker', 'firstName lastName')
      .populate('employer', 'businessName')
      .sort({ date: -1 })
      .limit(200);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/admin/sessions/disputes - מחלוקות
router.get('/sessions/disputes', ...adminOnly, async (req, res) => {
  try {
    const disputes = await WorkSession.find({ status: 'disputed' })
      .populate('worker', 'firstName lastName phone')
      .populate('employer', 'businessName phone')
      .sort({ date: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// PATCH /api/admin/sessions/:id/resolve - הכרעה בסכסוך
router.patch('/sessions/:id/resolve', ...adminOnly, async (req, res) => {
  try {
    const session = await WorkSession.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', employerApproved: true },
      { new: true }
    );
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

module.exports = router;

// DELETE /api/admin/users/:id - מחיקת משתמש
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'משתמש נמחק' });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// DELETE /api/admin/jobs/:id - מחיקת משרה
router.delete('/jobs/:id', ...adminOnly, async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'משרה נמחקה' });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// PATCH /api/admin/jobs/:id - עריכת משרה
router.patch('/jobs/:id', ...adminOnly, async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/admin/jobs - כל המשרות
router.get('/jobs', ...adminOnly, async (req, res) => {
  try {
    const jobs = await Job.find().populate('employer', 'businessName').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});
