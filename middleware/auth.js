const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'נדרשת התחברות' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'משתמש לא נמצא' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'טוקן לא תקין' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'אין הרשאה לפעולה זו' });
  }
  next();
};

module.exports = { auth, requireRole };
