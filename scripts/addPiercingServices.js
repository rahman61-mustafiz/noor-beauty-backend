/* One-off: rename "Threading" -> "Threading/Piercing" and add the 4 new
   piercing services from the latest menu card. Run once:
     node scripts/addPiercingServices.js */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const ServiceType = require('../src/models/ServiceType');
const Service = require('../src/models/Service');

const NEW_SERVICES = [
  { name: 'Ear Piercing (Gun)', price: 500, duration: 15, description: 'per ear' },
  { name: 'Ear Piercing (Surgical)', price: 1000, duration: 20, description: 'per ear' },
  { name: 'Nose Piercing (Gun)', price: 500, duration: 15, description: '' },
  { name: 'Nose Piercing (Surgical)', price: 1000, duration: 20, description: '' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected:', mongoose.connection.host);

  const threading = await ServiceType.findOne({ name: 'Threading' });
  if (!threading) throw new Error('ServiceType "Threading" not found');

  threading.name = 'Threading/Piercing';
  await threading.save();
  console.log('Renamed ServiceType -> "Threading/Piercing"');

  for (const s of NEW_SERVICES) {
    const exists = await Service.findOne({ name: s.name, serviceType: threading._id });
    if (exists) { console.log(`Already exists, skipping: ${s.name}`); continue; }
    await Service.create({
      name: s.name,
      description: s.description,
      serviceType: threading._id,
      category: threading.name,
      duration: s.duration,
      price: s.price,
      variants: [],
      isActive: true,
    });
    console.log(`Added: ${s.name} — ৳${s.price}${s.description ? ' (' + s.description + ')' : ''}`);
  }

  const count = await Service.countDocuments({ serviceType: threading._id });
  console.log(`\n"Threading/Piercing" now has ${count} services.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
