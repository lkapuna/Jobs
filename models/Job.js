const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'interested', 'rejected'], default: 'pending' },
  appliedAt: { type: Date, default: Date.now }
}, { _id: true });

const jobSchema = new mongoose.Schema({
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employerName: { type: String, default: '' },
  contactPerson: { type: String, default: '' },

  title: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  address: { type: String, default: '' },
  hourlyRate: { type: Number, default: 0 },
  profession: { type: String, required: true, trim: true },
  category: { type: String, default: '' },
  jobType: { type: String, default: 'קבועה' },
  days: [{ type: String }],
  hours: { type: String, default: '' },
  requirements: { type: String, default: '' },
  description: { type: String, default: '' },
  benefits: { type: String, default: '' },

  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['draft', 'open', 'closed'], default: 'open' },

  applicants: [applicantSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

jobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (!this.category) this.category = this.profession;
  this.isActive = this.status !== 'closed';
  next();
});

module.exports = mongoose.model('Job', jobSchema);
