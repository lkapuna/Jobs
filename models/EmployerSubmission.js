const mongoose = require('mongoose');

const employerSubmissionSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  employerContact: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerContact' },
  employerName: { type: String, default: '' },
  employerEmail: { type: String, default: '' },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  jobTitle: { type: String, default: '' },
  includeCv: { type: Boolean, default: true },
  includePhoneNotes: { type: Boolean, default: true },
  includeInterviewNotes: { type: Boolean, default: true },
  includeShareableNotes: { type: Boolean, default: true },
  message: { type: String, default: '' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmployerSubmission', employerSubmissionSchema);
