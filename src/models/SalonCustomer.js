const mongoose = require('mongoose');

// Walk-in customers created from the tablet live here, NOT in the app's `User`
// collection. The tablet still READS `User` to recognize app customers by phone,
// but never writes to it — keeping the customer app 100% untouched.
const salonCustomerSchema = new mongoose.Schema(
  {
    phone:       { type: String, required: true, unique: true, trim: true },
    name:        { type: String, required: true, trim: true },
    visitCount:  { type: Number, default: 0 },
    totalSpent:  { type: Number, default: 0 },
    lastVisitAt: { type: Date },
    note:        { type: String },
  },
  { timestamps: true }
);

// Same normalization rule as User.js, so phones match across both collections
// (lets us recognize the same person whether they came via app or walk-in).
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return '+' + digits;
  if (digits.startsWith('01') && digits.length === 11) return '+880' + digits.slice(1);
  return phone;
}

salonCustomerSchema.pre('save', function (next) {
  if (this.phone) this.phone = normalizePhone(this.phone);
  next();
});

salonCustomerSchema.statics.normalizePhone = normalizePhone;

module.exports = mongoose.model('SalonCustomer', salonCustomerSchema);
