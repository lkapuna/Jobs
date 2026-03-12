require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB מחובר');
    try {
      const User = require('./models/User');
      const existing = await User.findOne({ role: 'admin' });
      if (!existing) {
        // משתמשים ב-User.create כדי שה-pre-save יצפין את הסיסמה פעם אחת בלבד
        await User.create({
          role: 'admin',
          email: 'lkapuna@gmail.com',
          password: 'L220984k', // גולמית — ה-model יצפין אוטומטית
          phone: '0524332333',
          isActive: true
        });
        console.log('✅ אדמין נוצר: lkapuna@gmail.com / L220984k');
      } else {
        console.log('✅ אדמין קיים במערכת');
      }
    } catch(e) {
      console.error('שגיאה ביצירת אדמין:', e.message);
    }
  })
  .catch(err => console.error('❌ שגיאת MongoDB:', err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/admin', require('./routes/admin'));

io.on('connection', (socket) => {
  socket.on('join_chat', (chatId) => socket.join(chatId));
  socket.on('send_message', ({ chatId, message, sender }) => {
    io.to(chatId).emit('receive_message', { message, sender, time: new Date().toISOString() });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 השרת רץ על פורט ${PORT}`));
