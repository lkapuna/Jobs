const User = require('../models/User');

async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'alef.shin.jobs@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPhone = process.env.ADMIN_PHONE || '0500000000';

  if (!adminPassword) {
    console.warn('ADMIN_PASSWORD is not set. Admin auto-create skipped.');
    return;
  }

  if (adminPassword.length < 8) {
    console.warn('ADMIN_PASSWORD must be at least 8 characters. Admin auto-create skipped.');
    return;
  }

  const existing = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existing) {
    existing.role = 'admin';
    existing.password = adminPassword;
    existing.phone = existing.phone || adminPhone;
    existing.isActive = true;
    existing.isVerified = true;
    await existing.save();
    console.log(`Admin ensured: ${adminEmail}`);
    return;
  }

  await User.create({
    role: 'admin',
    email: adminEmail,
    password: adminPassword,
    phone: adminPhone,
    isActive: true,
    isVerified: true
  });

  console.log(`Admin created: ${adminEmail}`);
}

module.exports = ensureAdmin;
