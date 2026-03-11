const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['worker', 'employer', 'admin'],
    required: true
  },

  // משותף לכולם
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  profileImage: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },

  // עובד בלבד
  firstName: { type: String },
  lastName: { type: String },
  area: { type: String },
  jobType: { type: String }, // זמנית / קבועה
  profession: { type: String },
  description: { type: String },
  rating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },

  // מעסיק בלבד
  businessName: { type: String },
  contactName: { type: String },
  businessAddress: { type: String },
  businessField: { type: String },

  createdAt: { type: Date, default: Date.now }
});

// הצפנת סיסמה לפני שמירה
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// השוואת סיסמה
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// שם תצוגה
userSchema.virtual('displayName').get(function() {
  if (this.role === 'worker') return `${this.firstName} ${this.lastName}`;
  if (this.role === 'employer') return this.businessName;
  return 'Admin';
});

module.exports = mongoose.model('User', userSchema);
