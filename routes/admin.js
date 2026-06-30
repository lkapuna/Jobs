const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const WorkSession = require('../models/WorkSession');
const Candidate = require('../models/Candidate');
const { auth, requireRole } = require('../middleware/auth');

const adminOnly = [auth, requireRole('admin')];

router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [
      workers,
      employers,
      jobs,
      openJobs,
      sessions,
      candidates,
      newCandidates,
      talentPool
    ] = await Promise.all([
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments(),
      Job.countDocuments({ isActive: true, status: { $ne: 'closed' } }),
      WorkSession.find({ status: 'approved' }),
      Candidate.countDocuments(),
      Candidate.countDocuments({ status: 'new' }),
      Candidate.countDocuments({ status: 'talent_pool' })
    ]);

    const totalHours = sessions.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.workerFee || 0) + (s.employerFee || 0), 0);

    res.json({
      workers,
      employers,
      jobs,
      openJobs,
      candidates,
      newCandidates,
      talentPool,
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [
      { email: new RegExp(search, 'i') },
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { businessName: new RegExp(search, 'i') }
    ];

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Could not load users' });
  }
});

router.patch('/users/:id/block', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Could not update user' });
  }
});

router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete user' });
  }
});

router.get('/jobs', ...adminOnly, async (req, res) => {
  try {
    const jobs = await Job.find().populate('employer', 'businessName').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Could not load jobs' });
  }
});

router.post('/jobs', ...adminOnly, async (req, res) => {
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

router.patch('/jobs/:id', ...adminOnly, async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.category && !patch.profession) patch.profession = patch.category;
    if (patch.profession && !patch.category) patch.category = patch.profession;
    if (patch.status) patch.isActive = patch.status !== 'closed';
    patch.updatedAt = new Date();

    const job = await Job.findByIdAndUpdate(req.params.id, patch, { new: true });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'Could not update job' });
  }
});

router.delete('/jobs/:id', ...adminOnly, async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete job' });
  }
});

router.get('/sessions', ...adminOnly, async (req, res) => {
  try {
    const sessions = await WorkSession.find()
      .populate('worker', 'firstName lastName')
      .populate('employer', 'businessName')
      .sort({ date: -1 })
      .limit(200);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Could not load sessions' });
  }
});

router.get('/sessions/disputes', ...adminOnly, async (req, res) => {
  try {
    const disputes = await WorkSession.find({ status: 'disputed' })
      .populate('worker', 'firstName lastName phone')
      .populate('employer', 'businessName phone')
      .sort({ date: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: 'Could not load disputes' });
  }
});

router.patch('/sessions/:id/resolve', ...adminOnly, async (req, res) => {
  try {
    const session = await WorkSession.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', employerApproved: true },
      { new: true }
    );
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Could not resolve dispute' });
  }
});

module.exports = router;
