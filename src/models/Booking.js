const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    serviceName: { type: String },
    staff:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    startTime:   { type: Date, required: true },
    endTime:     { type: Date, required: true },
    status:      { type: String, enum: ['pending','confirmed','completed','cancelled'], default: 'pending' },
    notes:       { type: String },
    totalAmount: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);