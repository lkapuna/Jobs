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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log('MongoDB connected');
      await require('./lib/ensureAdmin')();
    })
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGODB_URI is not set. Configure it in Render before using the app.');
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/recruitment', require('./routes/recruitment'));
app.use('/api/agreements', require('./routes/agreements'));

app.get('/api/version', (req, res) => {
  res.json({ version: require('./package.json').version });
});

io.on('connection', socket => {
  socket.on('join_chat', chatId => {
    socket.join(chatId);
  });

  socket.on('send_message', ({ chatId, message, sender }) => {
    io.to(chatId).emit('receive_message', {
      message,
      sender,
      time: new Date().toISOString()
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
