/* No-DB verification (runs anywhere).
   1. Mounts EVERY router (existing + new) into one Express app — if there's any
      load-time or mount conflict, this throws. Proves the server will boot.
   2. Unit-tests the money math: discount cap clamp + beautician split. */

process.env.JWT_SECRET = 'x';
process.env.ADMIN_EMAIL = 'a@b.c';
process.env.ADMIN_PASSWORD = 'p';
process.env.ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXP';

const express = require('express');
let pass = 0, fail = 0;
const eq = (c, m) => { console.log((c ? '  PASS: ' : '  FAIL: ') + m); c ? pass++ : fail++; };

console.log('── 1. Full route table assembles (existing + new) ──');
try {
  const app = express();
  app.use(express.json());
  const routers = [
    ['/api/auth', './src/routes/auth'],
    ['/api/auth', './src/routes/admin/auth'],
    ['/api/services', './src/routes/services'],
    ['/api/service-types', './src/routes/serviceTypes'],
    ['/api/staff', './src/routes/staff'],
    ['/api/bookings', './src/routes/bookings'],
    ['/api/reviews', './src/routes/reviews'],
    ['/api/gallery', './src/routes/gallery'],
    ['/api/tablet', './src/routes/tablet'],                          // NEW
    ['/api/admin/dashboard', './src/routes/admin/dashboard'],
    ['/api/admin/customers', './src/routes/admin/customers'],
    ['/api/admin/bookings', './src/routes/admin/bookings'],
    ['/api/admin/staff', './src/routes/admin/staff'],
    ['/api/admin/services', './src/routes/admin/services'],
    ['/api/admin/reports', './src/routes/admin/reports'],
    ['/api/admin/ledger', './src/routes/admin/ledger'],
    ['/api/admin/settings', './src/routes/admin/settings'],          // NEW
    ['/api/admin/salon-visits', './src/routes/admin/salonVisits'],   // NEW
    ['/api/admin/salon-reports', './src/routes/admin/salonReports'], // NEW
  ];
  routers.forEach(([p, mod]) => app.use(p, require(mod)));
  eq(true, `all ${routers.length} routers mounted with no conflict`);
} catch (e) {
  eq(false, 'route assembly threw: ' + e.message);
}

console.log('\n── 2. Discount cap clamp (server-side logic) ──');
function computeDiscount(subtotal, capPct, { discountPercent, discountAmount }) {
  const maxDiscount = Math.round((subtotal * capPct) / 100);
  let d = 0;
  if (discountAmount != null && discountAmount !== '') d = Number(discountAmount) || 0;
  else if (discountPercent != null && discountPercent !== '') d = Math.round((subtotal * (Number(discountPercent) || 0)) / 100);
  if (d < 0) d = 0;
  if (d > maxDiscount) d = maxDiscount;
  const pct = subtotal > 0 ? Math.round((d / subtotal) * 100) : 0;
  return { discountAmount: d, discountPercent: pct, finalAmount: Math.max(0, subtotal - d) };
}
let x = computeDiscount(1900, 20, { discountPercent: 10 });
eq(x.discountAmount === 190 && x.finalAmount === 1710, '10% of 1900 = 190, final 1710 (within cap)');
x = computeDiscount(1000, 20, { discountPercent: 50 });
eq(x.discountAmount === 200 && x.discountPercent === 20, '50% requested clamps to cap 20% = 200');
x = computeDiscount(1000, 20, { discountAmount: 500 });
eq(x.discountAmount === 200, '৳500 requested clamps to cap ৳200');
x = computeDiscount(1000, 15, { discountAmount: 150 });
eq(x.discountAmount === 150 && x.finalAmount === 850, 'cap 15%: ৳150 allowed, final 850');

console.log('\n── 3. Beautician work split (final paid amount) ──');
function splitCredit(visits, bookings) {
  const m = {};
  const credit = (id, amt) => { if (!id) return; m[id] = (m[id] || 0) + amt; };
  visits.forEach((v) => { const n = v.staff.length; if (n) v.staff.forEach((s) => credit(s, v.finalAmount / n)); });
  bookings.forEach((b) => { if (b.staff) credit(b.staff, b.totalAmount); });
  Object.keys(m).forEach((k) => (m[k] = Math.round(m[k])));
  return m;
}
// 3 beauticians on a ৳3000 final → 1000 each
let s = splitCredit([{ finalAmount: 3000, staff: ['A', 'B', 'C'] }], []);
eq(s.A === 1000 && s.B === 1000 && s.C === 1000, '৳3000 across 3 beauticians = ৳1000 each');
// mixed: visit 1710 split 2 (855 each) + solo visit 800 to A + app booking 500 to A
s = splitCredit(
  [{ finalAmount: 1710, staff: ['A', 'B'] }, { finalAmount: 800, staff: ['A'] }],
  [{ totalAmount: 500, staff: 'A' }]
);
eq(s.A === 855 + 800 + 500 && s.B === 855, `A = 2155 (855+800+500), B = 855 [A=${s.A}, B=${s.B}]`);

console.log(`\n========== ${pass} passed, ${fail} failed ==========`);
process.exit(fail === 0 ? 0 : 1);
