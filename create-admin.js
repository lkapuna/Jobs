require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://lkapuna_jobs:L220984k@jobs-cluster.hpwgsvh.mongodb.net/workhour?appName=Jobs-cluster';

async function createAdmin() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB מחובר');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  // בדוק אם כבר קיים אדמין
  const existing = await users.findOne({ role: 'admin' });
  if (existing) {
    console.log('⚠️ אדמין כבר קיים! אימייל:', existing.email);
    process.exit(0);
  }

  const password = await bcrypt.hash('Admin1234!', 10);
  await users.insertOne({
    role: 'admin',
    email: 'admin@workhour.com',
    password,
    phone: '0500000000',
    isActive: true,
    createdAt: new Date()
  });

  console.log('✅ אדמין נוצר בהצלחה!');
  console.log('📧 אימייל: admin@workhour.com');
  console.log('🔑 סיסמה: Admin1234!');
  process.exit(0);
}

createAdmin().catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});
