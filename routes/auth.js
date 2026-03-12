const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// יצירת טוקן
const createToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/register/worker
router.post('/register/worker', async (req, res) => {
  try {
    const {
      firstName, lastName, phone, email, password,
      area, jobType, profession, description
    } = req.body;

    if (!firstName || !lastName || !phone || !email || !password || !area || !profession) {
      return res.status(400).json({ error: 'נא למלא את כל השדות החובה' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'אימייל כבר קיים במערכת' });

    const user = new User({
      role: 'worker',
      firstName, lastName, phone, email, password,
      area, jobType, profession, description
    });

    await user.save();
    const token = createToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהרשמה' });
  }
});

// POST /api/auth/register/employer
router.post('/register/employer', async (req, res) => {
  try {
    const {
      businessName, contactName, phone, email, password,
      businessAddress, businessField
    } = req.body;

    if (!businessName || !contactName || !phone || !email || !password || !businessAddress) {
      return res.status(400).json({ error: 'נא למלא את כל השדות החובה' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'אימייל כבר קיים במערכת' });

    const user = new User({
      role: 'employer',
      businessName, contactName, phone, email, password,
      businessAddress, businessField
    });

    await user.save();
    const token = createToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.businessName,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהרשמה' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'נא להזין אימייל וסיסמה' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'אימייל או סיסמה שגויים' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'אימייל או סיסמה שגויים' });

    if (!user.isActive) return res.status(403).json({ error: 'החשבון חסום, פנה לתמיכה' });

    const token = createToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.role === 'worker'
          ? `${user.firstName} ${user.lastName}`
          : user.businessName || 'Admin',
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});


// PATCH /api/auth/update-profile
router.patch('/update-profile', auth, async (req, res) => {
  try {
    const allowed = ['firstName','lastName','phone','businessName','contactName','businessAddress','profession','description','areas','jobTypes'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בעדכון' });
  }
});

module.exports = router;
