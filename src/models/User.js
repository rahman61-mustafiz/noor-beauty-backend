const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone:    { type: String, required: true, unique: true, trim: true },
    name:     { type: String, required: true, trim: true },
    email:    { type: String, trim: true, lowercase: true },
    password: { type: String, select: false },
    isBanned: { type: Boolean, default: false },
    fcmToken: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Normalize BD phone to +8801XXXXXXXXX before saving
userSchema.pre('save', function (next) {
  this.phone = normalizePhone(this.phone);
  next();
});

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return '+' + digits;
  if (digits.startsWith('01') && digits.length === 11) return '+880' + digits.slice(1);
  return phone;
}

userSchema.statics.normalizePhone = normalizePhone;

module.exports = mongoose.model('User', userSchema);
