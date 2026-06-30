const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ensureDatabaseReady } = require('../config/db');
const AdminUser = require('../models/AdminUser');

function adminConfig() {
  return {
    jwtSecret: process.env.ADMIN_JWT_SECRET || 'change-this-fleximagepro-admin-secret',
    jwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  };
}

async function verifyAdminCredentials(username, password) {
  const normalizedUsername = String(username || '').toLowerCase().trim();
  if (!normalizedUsername) {
    return { valid: false, reason: 'username' };
  }
  if (!password) {
    return { valid: false, reason: 'password' };
  }

  try {
    await ensureDatabaseReady();
    const adminUser = await AdminUser.findOne({ username: normalizedUsername, active: true }).maxTimeMS(5000);
    if (!adminUser) {
      return { valid: false, reason: 'username' };
    }
    const valid = await bcrypt.compare(password, adminUser.passwordHash);
    if (!valid) {
      return { valid: false, reason: 'password' };
    }
    if (valid) {
      adminUser.lastLoginAt = new Date();
      await adminUser.save();
    }
    return { valid: true, reason: 'ok' };
  } catch (error) {
    error.status = error.status || 503;
    error.message = error.message || 'Admin database is temporarily unavailable.';
    throw error;
  }
}

function signAdminToken(username) {
  const config = adminConfig();
  return jwt.sign(
    {
      role: 'admin',
      username: username || 'admin',
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      issuer: 'fleximagepro-backend',
    },
  );
}

function requireAdmin(req, res, next) {
  const config = adminConfig();
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Admin login required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      issuer: 'fleximagepro-backend',
    });
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only.' });
    }
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Admin session expired. Please login again.' });
  }
}

module.exports = {
  requireAdmin,
  signAdminToken,
  verifyAdminCredentials,
};
