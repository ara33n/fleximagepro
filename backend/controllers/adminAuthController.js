const bcrypt = require('bcryptjs');
const { ensureDatabaseReady } = require('../config/db');
const AdminUser = require('../models/AdminUser');
const { signAdminToken, verifyAdminCredentials } = require('../middleware/adminAuth');

async function loginAdmin(req, res, next) {
  try {
    const { username, password } = req.body || {};
    const normalizedUsername = String(username || '').toLowerCase().trim();
    const result = await verifyAdminCredentials(normalizedUsername, String(password || ''));
    if (!result.valid) {
      const error = result.reason === 'username'
        ? 'Admin username is incorrect.'
        : 'Admin password is incorrect.';
      return res.status(401).json({ error, field: result.reason });
    }

    res.json({
      status: 'Admin login successful',
      token: signAdminToken(normalizedUsername),
      admin: {
        username: normalizedUsername,
        role: 'admin',
      },
    });
  } catch (error) {
    next(error);
  }
}

function logoutAdmin(_req, res) {
  res.json({ status: 'Admin logged out successfully' });
}

function getAdminProfile(req, res) {
  res.json({
    admin: {
      username: req.admin.username,
      role: req.admin.role,
    },
  });
}

async function createAdminUser(req, res, next) {
  try {
    await ensureDatabaseReady();
    const username = String(req.body?.username || '').toLowerCase().trim();
    const password = String(req.body?.password || '');

    if (!/^[a-z0-9._-]{4,40}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 4-40 characters and use letters, numbers, dot, dash, or underscore.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const existing = await AdminUser.findOne({ username }).maxTimeMS(5000);
    if (existing) {
      return res.status(409).json({ error: 'This admin username already exists.' });
    }

    const admin = await AdminUser.create({
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      active: true,
    });

    res.status(201).json({
      status: 'Admin user created successfully',
      admin: {
        username: admin.username,
        role: admin.role,
        active: admin.active,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAdminUser,
  getAdminProfile,
  loginAdmin,
  logoutAdmin,
};
