const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['general', 'phone_call', 'front_interview', 'internal', 'shareable'],
    default: 'general'
  },
  text: { type: String, required: true },
  interviewer: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const cvSchema = new mongoose.Schema({
  originalName: { type: String, default: '' },
  filename: { type: String, default: '' },
  path: { type: String, default: '' },
  url: { type: String, default: '' },
  mimetype: { type: String, default: '' },
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date }
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  jobTitle: { type: String, default: '' },
  category: { type: String, default: '' },
  message: { type: String, default: '' },
  status: {
    type: String,
    enum: [
      'new',
      'in_progress',
      'contacted',
      'phone_call_done',
      'front_interview_done',
      'ready_to_send',
      'sent_to_employer',
      'waiting_employer',
      'sent_to_interview',
      'accepted',
      'started_working',
      'talent_pool',
      'not_relevant'
    ],
    default: 'new'
  },
  appliedAt: { type: Date, default: Date.now }
}, { _id: true });

const candidateSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  identityNumber: { type: String, trim: true, default: '' },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: '' },
  city: { type: String, trim: true, default: '' },
  area: { type: String, trim: true, default: '' },
  experience: { type: String, default: '' },
  availability: { type: String, default: '' },
  salaryExpectations: { type: String, default: '' },
  categories: [{ type: String, trim: true }],
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  status: {
    type: String,
    enum: [
      'new',
      'in_progress',
      'contacted',
      'phone_call_done',
      'front_interview_done',
      'ready_to_send',
      'sent_to_employer',
      'waiting_employer',
      'sent_to_interview',
      'accepted',
      'started_working',
      'talent_pool',
      'not_relevant'
    ],
    default: 'new'
  },
  startedWorkingAt: { type: Date },
  contactPerson: { type: String, default: '' },
  consentToStore: { type: Boolean, default: false },
  cv: { type: cvSchema, default: () => ({}) },
  applications: [applicationSchema],
  notes: [noteSchema],
  lastContactedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

candidateSchema.index({ phone: 1 });
candidateSchema.index({ email: 1 });
candidateSchema.index({ status: 1, categories: 1, area: 1 });

candidateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
