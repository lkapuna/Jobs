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
// חישוב שכר לפי חוק שעות עבודה ומנוחה הישראלי
function calcIsraeliPay(totalHours, hourlyRate) {
  const REGULAR = 8;       // שעות רגילות ביום
  const OT1_MAX = 2;       // שעות נוספות ב-125%
  const RATE_OT1 = 1.25;   // 125%
  const RATE_OT2 = 1.50;   // 150%

  let pay = 0;

  if (totalHours <= REGULAR) {
    // עד 8 שעות — רגיל
    pay = totalHours * hourlyRate;
  } else if (totalHours <= REGULAR + OT1_MAX) {
    // שעות 9-10 — 125%
    pay = (REGULAR * hourlyRate) +
          ((totalHours - REGULAR) * hourlyRate * RATE_OT1);
  } else {
    // שעה 11 ומעלה — 150%
    pay = (REGULAR * hourlyRate) +
          (OT1_MAX * hourlyRate * RATE_OT1) +
          ((totalHours - REGULAR - OT1_MAX) * hourlyRate * RATE_OT2);
  }

  return parseFloat(pay.toFixed(2));
}

workSessionSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    const diffMs = this.endTime - this.startTime;
    this.totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    // חישוב לפי חוק ישראלי (125%/150%)
    this.grossPay = calcIsraeliPay(this.totalHours, this.hourlyRate);

    // עמלת שעתי — 3 ₪ לשעה (על הרגילות + הנוספות לפי מספר השעות)
    this.workerFee = parseFloat((this.totalHours * 3).toFixed(2));
    this.employerFee = parseFloat((this.totalHours * 3).toFixed(2));
    this.netWorkerPay = parseFloat((this.grossPay - this.workerFee).toFixed(2));
    this.totalEmployerCost = parseFloat((this.grossPay + this.employerFee).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('WorkSession', workSessionSchema);
