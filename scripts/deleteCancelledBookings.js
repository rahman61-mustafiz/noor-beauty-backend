/* One-off cleanup: permanently delete app Booking documents that were
   soft-cancelled under the old system (before cancel started hard-deleting).
   Safe — cancelled bookings never counted toward any revenue figure, so
   nothing downstream is affected. Does NOT touch AdvanceBooking records
   (those stay even when cancelled, since a deposit already taken must
   remain in historical revenue math). Run once:
     node scripts/deleteCancelledBookings.js */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../src/models/Booking');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected:', mongoose.connection.host);

  const count = await Booking.countDocuments({ status: 'cancelled' });
  console.log(`Found ${count} cancelled app bookings.`);

  if (count === 0) {
    console.log('Nothing to delete.');
  } else {
    const result = await Booking.deleteMany({ status: 'cancelled' });
    console.log(`Deleted ${result.deletedCount} cancelled app bookings.`);
  }

  const remaining = await Booking.countDocuments();
  console.log(`Booking collection now has ${remaining} documents total.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
