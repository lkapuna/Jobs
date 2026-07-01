const mongoose = require('mongoose');
const crypto = require('crypto');

const placementAgreementSchema = new mongoose.Schema({
  token: { type: String, unique: true, default: () => crypto.randomBytes(24).toString('hex') },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'signed', 'started_working', 'waiting_payment', 'paid', 'cancelled'],
    default: 'draft'
  },

  employerContact: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerContact' },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },

  businessName: { type: String, default: '' },
  businessId: { type: String, default: '' },
  businessAddress: { type: String, default: '' },
  contactName: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  contactEmail: { type: String, default: '' },

  candidateName: { type: String, default: '' },
  candidatePhone: { type: String, default: '' },
  candidateIdentityNumber: { type: String, default: '' },
  candidateRole: { type: String, default: '' },
  candidateNumber: { type: String, default: '' },

  jobTitle: { type: String, default: '' },
  placementFee: { type: Number, default: 0 },
  vatPercent: { type: Number, default: 18 },
  sentAt: { type: Date },
  viewedAt: { type: Date },
  signedAt: { type: Date },
  notes: { type: String, default: '' },

  signerName: { type: String, default: '' },
  signerRole: { type: String, default: '' },
  signerPhone: { type: String, default: '' },
  signerEmail: { type: String, default: '' },
  signatureDataUrl: { type: String, default: '' },
  signatureId: { type: String, default: '' },
  signatureIp: { type: String, default: '' },
  signatureBrowser: { type: String, default: '' },
  signatureDevice: { type: String, default: '' },

  startedWorkingAt: { type: Date },
  paymentDueAt: { type: Date },
  paidAt: { type: Date },
  paidAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

placementAgreementSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PlacementAgreement', placementAgreementSchema);
