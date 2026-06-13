require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { connectDB } = require('./config/db');

const app = express();
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' })); // Tighten to your VPS domain in production
app.use(express.json({ limit: '10kb' }));

// Global rate limit: 100 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',               require('./routes/auth'));
app.use('/api/auth',               require('./routes/admin/auth')); // admin-login + verify-mfa
app.use('/api/services',           require('./routes/services'));
app.use('/api/service-types',      require('./routes/serviceTypes'));
app.use('/api/staff',              require('./routes/staff'));
app.use('/api/bookings',           require('./routes/bookings'));
app.use('/api/reviews',            require('./routes/reviews'));
app.use('/api/gallery',            require('./routes/gallery'));
app.use('/api/announcement',       require('./routes/announcement'));
app.use('/api/banner',            require('./routes/banner'));
app.use('/api/home-images',       require('./routes/homeImages'));
app.use('/api/home-images',       require('./routes/homeImages'));
app.use('/api/admin/dashboard',    require('./routes/admin/dashboard'));
app.use('/api/admin/customers',    require('./routes/admin/customers'));
app.use('/api/admin/bookings',     require('./routes/admin/bookings'));
app.use('/api/admin/staff',        require('./routes/admin/staff'));
app.use('/api/admin/services',     require('./routes/admin/services'));
app.use('/api/admin/service-types', require('./routes/admin/serviceTypes'));
app.use('/api/admin/reviews',      require('./routes/admin/reviews'));
app.use('/api/admin/analytics',    require('./routes/admin/analytics'));
app.use('/api/admin/reports',      require('./routes/admin/reports'));
app.use('/api/admin/ledger', require('./routes/admin/ledger'));
app.use('/api/admin/gallery',      require('./routes/admin/gallery'));
app.use('/api/admin/announcement', require('./routes/admin/announcement'));
app.use('/api/admin/banner',      require('./routes/admin/banner'));
app.use('/api/admin/home-images', require('./routes/admin/homeImages'));
app.use('/api/admin/home-images', require('./routes/admin/homeImages'));

app.get('/health', (_, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\nNoor Beauty API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      console.log(`Health: http://localhost:${PORT}/health\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
