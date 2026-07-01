require('dotenv').config();
const mongoose = require('mongoose');
const ensureAdmin = require('./lib/ensureAdmin');

async function createAdmin() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  await ensureAdmin();
}

createAdmin()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Admin creation failed:', err.message);
    process.exit(1);
  });
