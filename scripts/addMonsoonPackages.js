/* One-off: add the "Monsoon Package" category + 2 packages to MongoDB
   (tablet + app). Permanent until manually removed. Run once:
     node scripts/addMonsoonPackages.js */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const ServiceType = require('../src/models/ServiceType');
const Service = require('../src/models/Service');

const PACKAGES = [
  {
    name: 'Monsoon Package 1',
    price: 2500,
    duration: 90,
    includes: [
      'Drizzle Shine and Glow Facial',
      'Sparkling Hand Polish Massage with Exfoliation',
      'Hair Fall Defense Therapy',
      'Foot Nourishing Therapy with Exfoliation',
    ],
  },
  {
    name: 'Monsoon Package 2',
    price: 3000,
    duration: 90,
    includes: [
      'Monsoon Detox Facial with D-Tan Mask',
      'Monsoon Hand Spa Massage with Glow Boost Pack',
      'Monsoon Scalp and Hair Detox Therapy',
      'Foot and Leg Relaxation with Detox Pack',
    ],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected:', mongoose.connection.host);

  let type = await ServiceType.findOne({ name: 'Monsoon Package' });
  if (!type) {
    const maxOrder = (await ServiceType.find().sort({ order: -1 }).limit(1).lean())[0]?.order ?? -1;
    type = await ServiceType.create({ name: 'Monsoon Package', order: maxOrder + 1, icon: 'spa', isActive: true });
    console.log(`Created ServiceType "Monsoon Package" at order ${type.order}`);
  } else {
    console.log('ServiceType "Monsoon Package" already exists, reusing it');
  }

  for (const p of PACKAGES) {
    const exists = await Service.findOne({ name: p.name, serviceType: type._id });
    if (exists) { console.log(`Already exists, skipping: ${p.name}`); continue; }
    await Service.create({
      name: p.name,
      description: 'Includes:\n' + p.includes.map((i) => `- ${i}`).join('\n'),
      serviceType: type._id,
      category: type.name,
      duration: p.duration,
      price: p.price,
      variants: [],
      isActive: true,
    });
    console.log(`Added: ${p.name} — ৳${p.price}`);
  }

  const count = await Service.countDocuments({ serviceType: type._id });
  console.log(`\n"Monsoon Package" now has ${count} packages.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
