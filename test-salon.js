/* Local integration test — uses an in-memory MongoDB.
   Goals:
   1. Prove the FULL route table (existing + new) mounts together with no conflict.
   2. Prove the new tablet + admin endpoints work end-to-end.
   3. Prove existing endpoints still respond (nothing broke). */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_EMAIL = 'admin@noor.test';
  process.env.ADMIN_PASSWORD = 'pass';
  process.env.ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXP';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(process.env.MONGODB_URI);

  // Build an app that mounts EVERY router exactly like index.js does.
  const app = express();
  app.use(express.json());
  app.use('/api/auth',                require('./src/routes/auth'));
  app.use('/api/auth',                require('./src/routes/admin/auth'));
  app.use('/api/services',            require('./src/routes/services'));
  app.use('/api/service-types',       require('./src/routes/serviceTypes'));
  app.use('/api/staff',               require('./src/routes/staff'));
  app.use('/api/bookings',            require('./src/routes/bookings'));
  app.use('/api/reviews',             require('./src/routes/reviews'));
  app.use('/api/gallery',             require('./src/routes/gallery'));
  app.use('/api/tablet',              require('./src/routes/tablet'));
  app.use('/api/admin/dashboard',     require('./src/routes/admin/dashboard'));
  app.use('/api/admin/customers',     require('./src/routes/admin/customers'));
  app.use('/api/admin/bookings',      require('./src/routes/admin/bookings'));
  app.use('/api/admin/staff',         require('./src/routes/admin/staff'));
  app.use('/api/admin/services',      require('./src/routes/admin/services'));
  app.use('/api/admin/reports',       require('./src/routes/admin/reports'));
  app.use('/api/admin/ledger',        require('./src/routes/admin/ledger'));
  app.use('/api/admin/settings',      require('./src/routes/admin/salonSettings'));
  app.use('/api/admin/salon-visits',  require('./src/routes/admin/salonVisits'));
  app.use('/api/admin/salon-reports', require('./src/routes/admin/salonReports'));

  const Service     = require('./src/models/Service');
  const ServiceType = require('./src/models/ServiceType');
  const Staff       = require('./src/models/Staff');
  const User        = require('./src/models/User');

  const adminToken = jwt.sign({ sub: 'admin', type: 'admin' }, process.env.JWT_SECRET);
  const auth = { Authorization: `Bearer ${adminToken}` };

  let pass = 0, fail = 0;
  const ok  = (m) => { console.log('  PASS:', m); pass++; };
  const bad = (m) => { console.log('  FAIL:', m); fail++; };
  const eq  = (cond, m) => (cond ? ok(m) : bad(m));

  // ── Seed existing-style data ──
  const skin = await ServiceType.create({ name: 'Skin care', icon: 'sparkles', order: 1 });
  const facial = await Service.create({ name: 'Gold facial', serviceType: skin._id, category: 'Skin care', duration: 60, price: 1500 });
  const bleach = await Service.create({ name: 'Bleach', serviceType: skin._id, category: 'Skin care', duration: 30, price: 400 });
  const sumi = await Staff.create({ name: 'Sumi' });
  const riya = await Staff.create({ name: 'Riya' });
  const appUser = await User.create({ phone: '01712345678', name: 'Farida Begum' });

  console.log('\n── Existing endpoints still work ──');
  let r = await request(app).get('/api/services');
  eq(r.status === 200 && Array.isArray(r.body.data), 'GET /api/services returns list');
  r = await request(app).get('/api/staff');
  eq(r.status === 200, 'GET /api/staff responds 200');
  r = await request(app).get('/api/admin/ledger').set(auth);
  eq(r.status === 200, 'GET /api/admin/ledger (existing accounts) still works');

  console.log('\n── New tablet endpoints ──');
  r = await request(app).get('/api/tablet/services');
  eq(r.status === 200 && r.body.data.categories.length === 1 && r.body.data.services.length === 2,
     'GET /api/tablet/services returns 1 category + 2 services');
  eq(r.body.data.categories[0].count === 2, 'category service count = 2');

  r = await request(app).get('/api/tablet/staff');
  eq(r.status === 200 && r.body.data.length === 2, 'GET /api/tablet/staff returns 2 beauticians');

  r = await request(app).get('/api/tablet/discount-cap');
  eq(r.status === 200 && r.body.data.discountCapPercent === 20, 'discount cap defaults to 20%');

  // returning app customer recognized (read User, no write)
  r = await request(app).get('/api/tablet/customer/01712-345678');
  eq(r.status === 200 && r.body.data.found === true && r.body.data.source === 'app' && r.body.data.name === 'Farida Begum',
     'tablet recognizes existing app customer by phone (source=app)');

  // unknown phone
  r = await request(app).get('/api/tablet/customer/01999999999');
  eq(r.status === 200 && r.body.data.found === false, 'unknown phone returns found=false');

  console.log('\n── Create a visit (2 beauticians, discount within cap) ──');
  r = await request(app).post('/api/tablet/visit').send({
    customerPhone: '01888888888', customerName: 'Nasrin Akter',
    items: [
      { serviceId: facial._id.toString(), name: 'Gold facial', price: 1500 },
      { serviceId: bleach._id.toString(), name: 'Bleach', price: 400 },
    ],
    staffIds: [sumi._id.toString(), riya._id.toString()],
    discountPercent: 10, paymentMethod: 'cash',
  });
  eq(r.status === 201, 'POST /api/tablet/visit creates visit (201)');
  eq(r.body.data.subtotal === 1900, 'subtotal = 1900');
  eq(r.body.data.discountAmount === 190 && r.body.data.finalAmount === 1710, 'discount 10% = 190, final = 1710');

  console.log('\n── Server-side discount cap enforcement ──');
  r = await request(app).post('/api/tablet/visit').send({
    customerName: 'Over Discount', items: [{ name: 'Gold facial', price: 1000 }],
    staffIds: [sumi._id.toString()], discountPercent: 50, paymentMethod: 'cash',
  });
  eq(r.status === 201 && r.body.data.discountAmount === 200 && r.body.data.discountPercent === 20,
     '50% requested but clamped to cap 20% (200 of 1000)');

  console.log('\n── Walk-in customer recorded (not in User) ──');
  const SalonCustomer = require('./src/models/SalonCustomer');
  const wc = await SalonCustomer.findOne({ phone: '+8801888888888' }).lean();
  eq(!!wc && wc.visitCount === 1 && wc.totalSpent === 1710, 'walk-in SalonCustomer upserted with visitCount/totalSpent');
  const stillNoUser = await User.findOne({ phone: '+8801888888888' }).lean();
  eq(!stillNoUser, 'walk-in did NOT create a User (app collection untouched)');

  console.log('\n── Admin: set cap, then tablet sees new cap ──');
  r = await request(app).put('/api/admin/settings').set(auth).send({ discountCapPercent: 15 });
  eq(r.status === 200 && r.body.data.discountCapPercent === 15, 'admin sets cap to 15%');
  r = await request(app).get('/api/tablet/discount-cap');
  eq(r.body.data.discountCapPercent === 15, 'tablet now reads cap = 15%');

  console.log('\n── Admin: dashboard + beautician split ──');
  r = await request(app).get('/api/admin/salon-reports/dashboard').set(auth);
  eq(r.status === 200, 'GET salon-reports/dashboard 200');
  const sumiRow = r.body.data.beauticians.find((b) => b.name === 'Sumi');
  const riyaRow = r.body.data.beauticians.find((b) => b.name === 'Riya');
  // Visit1: 1710 split 2 => 855 each. Visit2: 800 final, Sumi only => 800.
  eq(sumiRow && sumiRow.amount === 855 + 800, `Sumi credited 1655 (855 split + 800 solo) [got ${sumiRow && sumiRow.amount}]`);
  eq(riyaRow && riyaRow.amount === 855, `Riya credited 855 (half of 1710) [got ${riyaRow && riyaRow.amount}]`);
  eq(r.body.data.payment.cash === 1710 + 800, 'cash payment total = 2510');

  console.log('\n── Admin: salon-visits list ──');
  r = await request(app).get('/api/admin/salon-visits').set(auth);
  eq(r.status === 200 && r.body.data.count === 2, 'salon-visits list returns 2 visits today');

  console.log(`\n========== ${pass} passed, ${fail} failed ==========`);

  await mongoose.disconnect();
  await mongod.stop();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
