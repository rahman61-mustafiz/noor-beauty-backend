const router = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const axios = require('axios');

// Bookings submitted via noor-salon.com's public form. These live in a
// SEPARATE Supabase/Postgres project (the website's own database — a
// different codebase, different hosting, no other connection to this Mongo
// backend). Read here via the service_role key (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY env vars) purely so they can appear in the same
// unified Bookings view/calendar as tablet visits + app bookings.
function supabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ── GET /api/admin/website-bookings ───────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  if (!supabaseConfigured()) {
    // Not wired up yet — respond with an empty, clearly-flagged list instead
    // of an error, so the merged Bookings view just shows 0 website bookings
    // until SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set on Railway.
    return res.json({ data: [], configured: false });
  }
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/bookings?select=*&order=created_at.desc`;
    const r = await axios.get(url, { headers: supabaseHeaders() });
    res.json({
      configured: true,
      data: r.data.map((b) => ({
        id: b.id,
        customerName: b.name,
        customerPhone: b.phone,
        serviceLabel: b.service || 'Inquiry',
        message: b.message || '',
        when: b.preferred_date, // date only — the website form has no time-of-day field
        status: b.status, // 'new' | 'confirmed' | 'done' | 'cancelled'
        createdAt: b.created_at,
      })),
    });
  } catch (err) {
    console.error('website-bookings list error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Failed to load website bookings — check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' });
  }
});

// ── DELETE /api/admin/website-bookings/:id ────────────────────────────────────
// Permanently deletes the row from the website's own Supabase table — there's
// only one copy of this data, shared with noor-salon.com's own admin panel.
router.delete('/:id', adminAuth, async (req, res) => {
  if (!supabaseConfigured()) {
    return res.status(503).json({ message: 'Website booking sync is not configured yet' });
  }
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(req.params.id)}`;
    await axios.delete(url, { headers: supabaseHeaders() });
    res.json({ data: { id: req.params.id, deleted: true } });
  } catch (err) {
    console.error('website-bookings delete error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Failed to delete website booking' });
  }
});

module.exports = router;
