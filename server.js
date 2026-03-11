require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB מחובר'))
  .catch(err => console.error('❌ שגיאת MongoDB:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/admin', require('./routes/admin'));

// Socket.io - צ'אט בזמן אמת
const activeChats = {};

io.on('connection', (socket) => {
  console.log('משתמש התחבר:', socket.id);

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('send_message', ({ chatId, message, sender }) => {
    io.to(chatId).emit('receive_message', {
      message,
      sender,
      time: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log('משתמש התנתק:', socket.id);
  });
});

// Fallback לדפי HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 השרת רץ על פורט ${PORT}`);
});
