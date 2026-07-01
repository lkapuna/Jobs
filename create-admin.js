require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'alef.shin.jobs@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE || '0500000000';

async function createAdmin() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    throw new Error('ADMIN_PASSWORD is required and must be at least 8 characters');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const User = require('./models/User');
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    existing.role = 'admin';
    existing.password = password;
    existing.phone = existing.phone || ADMIN_PHONE;
    existing.isActive = true;
    existing.isVerified = true;
    await existing.save();
    console.log(`Admin updated: ${ADMIN_EMAIL}`);
    return;
  }

  await User.create({
    role: 'admin',
    email: ADMIN_EMAIL,
    password,
    phone: ADMIN_PHONE,
    isActive: true,
    isVerified: true
  });

  console.log(`Admin created: ${ADMIN_EMAIL}`);
}

createAdmin()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Admin creation failed:', err.message);
    process.exit(1);
  });
