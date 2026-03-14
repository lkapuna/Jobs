const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');

// GET /api/chat/my-conversations - כל השיחות של המשתמש הנוכחי
router.get('/my-conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const msgs = await Message.find({
      $or: [
        { chat: new RegExp(userId) },
        { sender: req.user._id }
      ]
    }).populate('sender', 'firstName lastName businessName role').sort({ createdAt: -1 });

    const convMap = {};
    for (const msg of msgs) {
      const chatId = msg.chat;
      if (!chatId.includes(userId)) continue;
      if (!convMap[chatId]) {
        const parts = chatId.split('_');
        const otherId = parts.find(p => p !== userId);
        convMap[chatId] = { chatId, otherId, otherName: null, lastMessage: msg.text, unread: 0, updatedAt: msg.createdAt };
      }
      if (msg.sender?._id?.toString() !== userId && !msg.read) convMap[chatId].unread++;
      if (msg.sender?._id?.toString() !== userId && !convMap[chatId].otherName) {
        const s = msg.sender;
        convMap[chatId].otherName = s?.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : (s?.businessName || 'משתמש');
      }
    }

    const User = require('../models/User');
    const convList = Object.values(convMap);
    for (const conv of convList) {
      if (!conv.otherName && conv.otherId) {
        try {
          const u = await User.findById(conv.otherId).select('firstName lastName businessName role');
          if (u) conv.otherName = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.businessName || (u.role === 'admin' ? 'אדמין' : 'משתמש'));
        } catch(e) {}
      }
      if (!conv.otherName) conv.otherName = 'שיחה';
    }
    convList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(convList);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/chat/:chatId - טען הודעות של שיחה
router.get('/:chatId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'firstName lastName businessName')
      .sort({ createdAt: 1 });
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
    const msg = await Message.create({ chat: req.params.chatId, sender: req.user._id, senderRole: req.user.role, text: text.trim() });
    await msg.populate('sender', 'firstName lastName businessName');
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// GET /api/chat/unread/count
router.get('/unread/count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({ sender: { $ne: req.user._id }, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
});

module.exports = router;
