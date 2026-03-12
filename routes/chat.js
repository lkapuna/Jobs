const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');

// GET /api/chat/:chatId - טען הודעות של שיחה
router.get('/:chatId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'firstName lastName businessName')
      .sort({ createdAt: 1 });
    
    // סמן כנקרא
    await Message.updateMany(
      { chat: req.params.chatId, sender: { $ne: req.user._id }, read: false },
      { read: true }
    );
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// POST /api/chat/:chatId - שלח הודעה
router.post('/:chatId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'הודעה ריקה' });
    
    const msg = await Message.create({
      chat: req.params.chatId,
      sender: req.user._id,
      senderRole: req.user.role,
      text: text.trim()
    });
    
    await msg.populate('sender', 'firstName lastName businessName');
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/chat/unread/count - כמה שיחות עם הודעות שלא נקראו
router.get('/unread/count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      sender: { $ne: req.user._id },
      read: false
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
});

module.exports = router;
