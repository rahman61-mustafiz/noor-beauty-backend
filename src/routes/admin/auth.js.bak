const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { totp } = require('otplib');

// In-memory MFA session store (TTL 10 min)
const mfaSessions = new Map();

function getAdminCredentials() {
  return {
    email:     process.env.ADMIN_EMAIL,
    password:  process.env.ADMIN_PASSWORD,
    mfaSecret: process.env.ADMIN_MFA_SECRET,
  };
}

// ── POST /api/auth/admin-login ────────────────────────────────────────────────

router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = getAdminCredentials();
    if (email.toLowerCase() !== admin.email.toLowerCase()) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Support both plain-text (dev) and bcrypt (prod) passwords in .env
    let passwordValid = false;
    if (admin.password.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, admin.password);
    } else {
      passwordValid = password === admin.password;
    }

    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const sessionToken = uuidv4();
    mfaSessions.set(sessionToken, {
      email: admin.email,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Auto-clean expired sessions
    setTimeout(() => mfaSessions.delete(sessionToken), 10 * 60 * 1000);

    res.json({
      sessionToken,
      mfaRequired: true,
      admin: { email: admin.email },
    });
  } catch (err) {
    console.error('admin-login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// ── POST /api/auth/verify-mfa ─────────────────────────────────────────────────

router.post('/verify-mfa', (req, res) => {
  try {
    const { sessionToken, code } = req.body;
    if (!sessionToken || !code) {
      return res.status(400).json({ message: 'Session token and code are required' });
    }

    const session = mfaSessions.get(sessionToken);
    if (!session || Date.now() > session.expiresAt) {
      mfaSessions.delete(sessionToken);
      return res.status(401).json({ message: 'MFA session expired. Please login again.' });
    }

    const admin = getAdminCredentials();
    const isValid = totp.verify({ token: code.trim(), secret: admin.mfaSecret });
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid MFA code' });
    }

    mfaSessions.delete(sessionToken);

    const adminToken = jwt.sign(
      { sub: 'admin', email: session.email, type: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      accessToken: adminToken,
      admin: { id: 'admin', email: session.email },
    });
  } catch (err) {
    console.error('verify-mfa error:', err);
    res.status(500).json({ message: 'MFA verification failed' });
  }
});

module.exports = router;
