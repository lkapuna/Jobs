const mongoose = require('mongoose');

const workSessionSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },

  startTime: { type: Date },
  endTime: { type: Date },
  startLocation: {
    lat: Number,
    lng: Number
  },

  // חישוב
  totalHours: { type: Number, default: 0 },
  hourlyRate: { type: Number, required: true },
  grossPay: { type: Number, default: 0 },       // שכר גולמי
  workerFee: { type: Number, default: 0 },       // עמלה מהעובד (3₪ לשעה)
  employerFee: { type: Number, default: 0 },     // עמלה מהמעסיק (3₪ לשעה)
  netWorkerPay: { type: Number, default: 0 },    // נטו לעובד
  totalEmployerCost: { type: Number, default: 0 }, // סה"כ עלות למעסיק

  status: {
    type: String,
    enum: ['active', 'pending_approval', 'approved', 'disputed', 'corrected'],
    default: 'active'
  },

  employerApproved: { type: Boolean, default: false },
  employerCorrectedHours: { type: Number },
  disputeReason: { type: String },

  date: { type: Date, default: Date.now }
});

// חישוב אוטומטי בעת שמירה
workSessionSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    const diffMs = this.endTime - this.startTime;
    this.totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    this.grossPay = parseFloat((this.totalHours * this.hourlyRate).toFixed(2));
    this.workerFee = parseFloat((this.totalHours * 3).toFixed(2));
    this.employerFee = parseFloat((this.totalHours * 3).toFixed(2));
    this.netWorkerPay = parseFloat((this.grossPay - this.workerFee).toFixed(2));
    this.totalEmployerCost = parseFloat((this.grossPay + this.employerFee).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('WorkSession', workSessionSchema);
