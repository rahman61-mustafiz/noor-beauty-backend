const mongoose = require('mongoose');

const otpSessionSchema = new mongoose.Schema({
  sessionToken: { type: String, required: true, unique: true, index: true },
  phone:        { type: String, required: true },
  otp:          { type: String, required: true },
  attempts:     { type: Number, default: 0 },
  expiresAt:    { type: Date,   required: true, index: { expires: 0 } },
});

module.exports = mongoose.model('OtpSession', otpSessionSchema);
