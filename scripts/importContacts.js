// One-time import of customer contacts into the SalonCustomer collection.
// Reads scripts/imported_contacts.json (already normalized + de-duplicated by the
// export step) and upserts each contact. Uses $setOnInsert so existing phone
// numbers are NEVER overwritten — new contacts are added, dupes are skipped.
//
// Usage (from the backend root):
//   node scripts/importContacts.js          # perform the import
//   node scripts/importContacts.js --dry     # connect + report only, no writes
//
// Reads MONGODB_URI from .env (same connection the server uses).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const mongoose = require('mongoose');
const SalonCustomer = require('../src/models/SalonCustomer');

// Node's bundled DNS resolver (c-ares) is refused by some local DNS servers when
// doing the SRV/TXT lookups that mongodb+srv:// needs. Point it at public DNS so
// the Atlas SRV record resolves (Windows' own resolver already works here).
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, 'imported_contacts.json');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));
  const contacts = (Array.isArray(raw) ? raw : [])
    .filter((c) => c && c.phone && c.name);
  console.log(`Loaded ${contacts.length} contacts from ${FILE}`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('MongoDB connected:', mongoose.connection.host);

  const before = await SalonCustomer.countDocuments();
  console.log(`SalonCustomer count before: ${before}`);

  if (DRY) {
    console.log('[--dry] No writes performed. Exiting.');
    await mongoose.disconnect();
    return;
  }

  const ops = contacts.map((c) => ({
    updateOne: {
      filter: { phone: c.phone },
      update: { $setOnInsert: { phone: c.phone, name: c.name, note: 'Imported from customer list 2026-06-17' } },
      upsert: true,
    },
  }));

  const res = await SalonCustomer.bulkWrite(ops, { ordered: false });
  const inserted = res.upsertedCount || 0;
  const matched = res.matchedCount || 0;

  const after = await SalonCustomer.countDocuments();
  console.log('==================== IMPORT RESULT ====================');
  console.log(`Inserted (new) ............ ${inserted}`);
  console.log(`Skipped (already existed) . ${matched}`);
  console.log(`SalonCustomer count after . ${after}  (was ${before})`);

  await mongoose.disconnect();
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
