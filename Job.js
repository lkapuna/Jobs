const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  title: { type: String, required: true },
  area: { type: String, required: true },
  address: { type: String, required: true },
  hourlyRate: { type: Number, required: true },
  profession: { type: String, required: true },
  jobType: { type: String, enum: ['זמנית', 'קבועה'], required: true },
  days: [{ type: String }], // ימים בשבוע
  hours: { type: String }, // לדוגמה: "09:00-17:00"
  requirements: { type: String },
  description: { type: String },

  isActive: { type: Boolean, default: true },

  // מועמדים שפנו
  applicants: [{
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String },
    status: { type: String, enum: ['pending', 'interested', 'rejected'], default: 'pending' },
    appliedAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
