const mongoose = require('mongoose');

const employerContactSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  contactName: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  field: { type: String, trim: true, default: '' },
  area: { type: String, trim: true, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

employerContactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('EmployerContact', employerContactSchema);
