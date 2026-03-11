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
