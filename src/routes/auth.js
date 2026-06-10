const router  = require('express').Router();
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');

const User       = require('../models/User');
const OtpSession = require('../models/OtpSession');
const { sendSms } = require('../services/sms');

// ── BD phone validation ──────────────────────────────────────────────────────

// Valid BD mobile prefixes (Grameenphone, Robi, Banglalink, Teletalk, Airtel)
const BD_MOBILE_REGEX = /^(?:\+?880|0)?1[3-9]\d{8}$/;

function validateBdPhone(phone) {
  return BD_MOBILE_REGEX.test(phone.replace(/\s/g, ''));
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return '+' + digits;
  if (digits.startsWith('01') && digits.length === 11) return '+880' + digits.slice(1);
  if (digits.startsWith('1') && digits.length === 10) return '+8801' + digits.slice(1);
  return phone;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

const sendOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => req.body.phone || req.ip,
  message: { message: 'Too many OTP requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body.sessionToken || req.ip,
  message: { message: 'Too many verification attempts.' },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function issueTokens(userId) {
  const access = jwt.sign(
    { sub: userId, type: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refresh = jwt.sign(
    { sub: userId, type: 'customer_refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { access, refresh };
}

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────

router.post('/send-otp', sendOtpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) return res.status(400).json({ message: 'Phone number is required' });
    if (!validateBdPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid Bangladeshi mobile number' });
    }

    const normalized = normalizePhone(phone);
    const otp        = generateOtp();
    const sessionToken = uuidv4();
    const expiresAt  = new Date(Date.now() + 30 * 60 * 1000); // 5 minutes

    // Remove any existing session for this phone
    await OtpSession.deleteMany({ phone: normalized });

    await OtpSession.create({ sessionToken, phone: normalized, otp, expiresAt });

    const message = `Your Noor Beauty OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
    await sendSms(normalized, message);

    const isNewUser = !(await User.exists({ phone: normalized }));

    const response = {
      sessionToken,
      expiresIn: 300,
      isNewUser,
      message: `OTP sent to ${phone.slice(0, 4)}XXXXXXX`,
    };

    // Expose OTP in dev mode only
    if (process.env.NODE_ENV !== 'production') {
      response._devOtp = otp;
    }

    res.json(response);
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────

router.post('/verify-otp', verifyOtpLimiter, async (req, res) => {
  try {
    const { phone, otp, name } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const normalized = normalizePhone(phone);
    const session = await OtpSession.findOne({ phone: normalized });

    if (!session) {
      return res.status(400).json({ message: 'OTP session expired or not found. Request a new OTP.' });
    }

    if (new Date() > session.expiresAt) {
      await OtpSession.deleteOne({ sessionToken });
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    session.attempts += 1;

    if (session.attempts > 5) {
      await OtpSession.deleteOne({ sessionToken });
      return res.status(400).json({ message: 'Too many wrong attempts. Please request a new OTP.' });
    }

    if (session.otp !== otp.trim()) {
      await session.save();
      const remaining = 5 - session.attempts;
      return res.status(400).json({
        message: remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : 'Incorrect OTP.',
      });
    }

    // OTP is correct — clean up session
    await OtpSession.deleteOne({ sessionToken });

    // Find or create user
    let user = await User.findOne({ phone: session.phone });
    const isNewUser = !user;

    if (isNewUser) {
      const safeName = (name && name.trim().length >= 2) ? name.trim() : 'Guest';
      user = await User.create({ phone: session.phone, name: safeName });
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been suspended. Contact support.' });
    }

    const { access, refresh } = issueTokens(user._id.toString());

    res.json({
      accessToken: access,
      refreshToken: refresh,
      isNewUser,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        email: user.email || null,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    if (payload.type !== 'customer_refresh') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    const user = await User.findById(payload.sub);
    if (!user || user.isBanned) {
      return res.status(401).json({ message: 'Account not found or suspended' });
    }

    const { access, refresh } = issueTokens(user._id.toString());
    res.json({ accessToken: access, refreshToken: refresh });
  } catch (err) {
    console.error('refresh error:', err);
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { phone, name, password } = req.body;

    if (!phone || !name || !password) {
      return res.status(400).json({ message: 'Phone, name, and password are required' });
    }
    if (!validateBdPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid Bangladeshi mobile number' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalized = normalizePhone(phone);
    const existing = await User.findOne({ phone: normalized });
    if (existing) {
      return res.status(409).json({ message: 'An account with this number already exists. Please log in.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ phone: normalized, name: name.trim(), password: hashed });

    const { access, refresh } = issueTokens(user._id.toString());

    res.status(201).json({
      accessToken: access,
      refreshToken: refresh,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        email: user.email || null,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }
    if (!validateBdPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid Bangladeshi mobile number' });
    }

    const normalized = normalizePhone(phone);
    const user = await User.findOne({ phone: normalized }).select('+password');

    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid phone number or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid phone number or password' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been suspended. Contact support.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { access, refresh } = issueTokens(user._id.toString());

    res.json({
      accessToken: access,
      refreshToken: refresh,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        email: user.email || null,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/change-password ────────────────────────────────────────────

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.password) {
      return res.status(400).json({ message: 'No password set on this account. Please contact support.' });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(500).json({ message: 'Failed to change password. Please try again.' });
  }
});

module.exports = router;
