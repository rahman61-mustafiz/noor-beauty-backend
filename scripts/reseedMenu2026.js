/* One-off maintenance script: replace ServiceType + Service collections with the
   2026 menu (src/data/menu2026.json). Run once from the backend project root:
     node scripts/reseedMenu2026.js
   Existing Booking documents keep their `serviceName` snapshot, so historical
   bookings still display correctly even though their `service` ref will be
   dangling after this reseed (services are deleted and recreated with new ids). */

require('dotenv').config();
const mongoose = require('mongoose');
const ServiceType = require('../src/models/ServiceType');
const Service = require('../src/models/Service');
const menu = require('../src/data/menu2026.json');

// [minDurationMin, maxDurationMin] per category slug — interpolated across each
// category's own price range so pricier/heavier services get longer durations.
const DURATION_RANGES = {
  'hair-cutting': [20, 60],
  'hair-color': [30, 180],
  'facial': [45, 90],
  'body-spa': [60, 120],
  'eye-lash': [45, 90],
  'add-on-makeover': [10, 30],
  'bridal-packages': [120, 300],
  'hair-setting': [15, 60],
  'hair-treatment': [30, 90],
  'happy-hour-package': [90, 150],
  'makeup-package': [60, 120],
  'nail-extension': [20, 90],
  'noor-package': [90, 180],
  'shine-set': [120, 240],
  'threading': [10, 20],
  'waxing': [10, 45],
  'pedicure-manicure': [60, 90],
  'glow-polish': [20, 60],
  'special-offers': [90, 120],
  'princess-package': [60, 90],
  'teenage-package': [60, 90],
  'lash-brow': [45, 90],
};

function repPrice(cat, entry) {
  if (cat.kind === 'tiered') return Math.min(...entry.prices);
  if (cat.kind === 'packages') return entry.price;
  return entry.price != null ? entry.price : parseRangeMidpoint(entry.note);
}

function parseRangeMidpoint(note) {
  const m = String(note || '').match(/([\d,]+)\s*-\s*([\d,]+)/);
  if (!m) return 0;
  const a = Number(m[1].replace(/,/g, ''));
  const b = Number(m[2].replace(/,/g, ''));
  return Math.round((a + b) / 2 / 100) * 100;
}

function computeDuration(slug, price, minPrice, maxPrice) {
  const [minDur, maxDur] = DURATION_RANGES[slug] || [30, 60];
  if (maxPrice === minPrice) return minDur;
  const frac = (price - minPrice) / (maxPrice - minPrice);
  return Math.max(5, Math.round((minDur + frac * (maxDur - minDur)) / 5) * 5);
}

function buildPackageDescription(pkg) {
  const lines = [];
  if (pkg.occasion) lines.push(`Occasion: ${pkg.occasion}`);
  if (pkg.regular_price) lines.push(`Regular price: ৳${pkg.regular_price}`);
  if (Array.isArray(pkg.includes) && pkg.includes.length) {
    lines.push('Includes:');
    pkg.includes.forEach((inc) => lines.push(`- ${inc}`));
  }
  return lines.join('\n');
}

async function main() {
  const dryRun = !!process.env.DRY_RUN;

  if (!dryRun) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('Connected:', mongoose.connection.host);
  }

  const beforeTypes = dryRun ? 0 : await ServiceType.countDocuments();
  const beforeServices = dryRun ? 0 : await Service.countDocuments();

  const priceResolutionNotes = [];
  const serviceTypeDocs = [];
  const serviceDocsByIndex = [];

  menu.forEach((cat, index) => {
    serviceTypeDocs.push({
      name: cat.title,
      description: cat.note || cat.subtitle || '',
      icon: 'spa',
      order: index,
      isActive: true,
    });

    const entries = cat.kind === 'packages' ? cat.packages : cat.items;
    const prices = entries.map((e) => repPrice(cat, e));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const docs = entries.map((entry, i) => {
      const price = prices[i];
      const duration = computeDuration(cat.slug, price, minPrice, maxPrice);

      if (cat.kind === 'tiered') {
        return {
          name: entry.name,
          description: entry.note || '',
          category: cat.title,
          duration,
          price,
          variants: cat.tier_labels.map((label, li) => ({ label, price: entry.prices[li] })),
          isActive: true,
        };
      }

      if (cat.kind === 'packages') {
        return {
          name: entry.name,
          description: buildPackageDescription(entry),
          category: cat.title,
          duration,
          price,
          variants: [],
          isActive: true,
        };
      }

      if (entry.price == null) {
        priceResolutionNotes.push(`${cat.title} / ${entry.name}: null price -> resolved to ৳${price} from note "${entry.note}"`);
      }
      return {
        name: entry.name,
        description: entry.note || '',
        category: cat.title,
        duration,
        price,
        variants: [],
        isActive: true,
      };
    });

    serviceDocsByIndex.push(docs);
  });

  if (dryRun) {
    const totalServices = serviceDocsByIndex.reduce((s, d) => s + d.length, 0);
    console.log(`DRY RUN — would create ${serviceTypeDocs.length} service types, ${totalServices} services.`);
    serviceTypeDocs.forEach((t, i) => {
      const docs = serviceDocsByIndex[i];
      const prices = docs.map((d) => d.price);
      const durations = docs.map((d) => d.duration);
      console.log(
        `  [${t.order}] ${t.name}: ${docs.length} services, price ৳${Math.min(...prices)}-৳${Math.max(...prices)}, duration ${Math.min(...durations)}-${Math.max(...durations)}min`
      );
    });
    if (priceResolutionNotes.length) {
      console.log('\nNull-price items resolved from note ranges:');
      priceResolutionNotes.forEach((n) => console.log(' -', n));
    }
    console.log('\nSample docs (Hair Color, tiered):');
    console.log(JSON.stringify(serviceDocsByIndex[1].slice(0, 2), null, 2));
    console.log('\nSample docs (Bridal Packages):');
    console.log(JSON.stringify(serviceDocsByIndex[6].slice(0, 1), null, 2));
    return;
  }

  console.log(`\nDeleting existing data: ${beforeTypes} service types, ${beforeServices} services...`);
  await Service.deleteMany({});
  await ServiceType.deleteMany({});

  console.log('Inserting new menu...');
  const insertedTypes = await ServiceType.insertMany(serviceTypeDocs);

  let totalServices = 0;
  for (let i = 0; i < insertedTypes.length; i++) {
    const typeId = insertedTypes[i]._id;
    const docs = serviceDocsByIndex[i].map((d) => ({ ...d, serviceType: typeId }));
    await Service.insertMany(docs);
    totalServices += docs.length;
  }

  console.log(`\nDone. ${insertedTypes.length} service types, ${totalServices} services inserted.`);
  if (priceResolutionNotes.length) {
    console.log('\nNull-price items resolved from note ranges:');
    priceResolutionNotes.forEach((n) => console.log(' -', n));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
