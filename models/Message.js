const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: { type: String, required: true }, // jobId_workerId
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['worker', 'employer'] },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
