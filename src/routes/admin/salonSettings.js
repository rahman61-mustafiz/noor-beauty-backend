const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Settings  = require('../../models/Settings');

const DEFAULTS = {
  discountCapPercent: 20,
  showDiscountOnReceipt: true,
  trackDiscountInReports: true,
};

// ── GET /api/admin/settings ───────────────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const out = {};
    for (const key of Object.keys(DEFAULTS)) {
      out[key] = await Settings.get(key, DEFAULTS[key]);
    }
    res.json({ data: out });
  } catch (err) {
    console.error('settings get error:', err);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

// ── PUT /api/admin/settings ───────────────────────────────────────────────────
// Send any subset of the keys. Discount cap is clamped to 0–100.
router.put('/', adminAuth, async (req, res) => {
  try {
    const updates = {};

    if (req.body.discountCapPercent != null) {
      let cap = Number(req.body.discountCapPercent);
      if (isNaN(cap)) cap = DEFAULTS.discountCapPercent;
      cap = Math.max(0, Math.min(100, Math.round(cap)));
      await Settings.set('discountCapPercent', cap);
      updates.discountCapPercent = cap;
    }
    if (req.body.showDiscountOnReceipt != null) {
      const v = !!req.body.showDiscountOnReceipt;
      await Settings.set('showDiscountOnReceipt', v);
      updates.showDiscountOnReceipt = v;
    }
    if (req.body.trackDiscountInReports != null) {
      const v = !!req.body.trackDiscountInReports;
      await Settings.set('trackDiscountInReports', v);
      updates.trackDiscountInReports = v;
    }

    res.json({ data: updates });
  } catch (err) {
    console.error('settings put error:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
