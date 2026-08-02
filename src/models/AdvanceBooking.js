const mongoose = require('mongoose');

// Same shape as SalonVisit's line items — a service snapshotted at booking time.
const lineItemSchema = new mongoose.Schema(
  {
    service:  { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name:     { type: String, required: true, trim: true },
    price:    { type: Number, required: true },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const paymentSplitSchema = new mongoose.Schema(
  {
    cash:  { type: Number, default: 0 },
    bkash: { type: Number, default: 0 },
    card:  { type: Number, default: 0 },
  },
  { _id: false }
);

// A future event (e.g. a bridal booking) with a deposit taken today and a
// balance due on the event day. `advanceAmount` counts as revenue the day it's
// created; `dueAmount` counts as revenue the day it's settled (see routes/advanceBookings.js) —
// together they always equal totalAmount, so nothing is double-counted or missed.
const advanceBookingSchema = new mongoose.Schema(
  {
    customerName:  { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },

    eventDate: { type: Date, required: true },
    items:     { type: [lineItemSchema], default: [] },
    staff:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],

    totalAmount:   { type: Number, required: true },
    advanceAmount: { type: Number, required: true },
    dueAmount:     { type: Number, required: true },

    advancePayments: { type: paymentSplitSchema, default: () => ({ cash: 0, bkash: 0, card: 0 }) },
    duePayments:      { type: paymentSplitSchema, default: () => ({ cash: 0, bkash: 0, card: 0 }) },

    status: { type: String, enum: ['pending', 'settled', 'cancelled'], default: 'pending' },

    // Filled in once settled: the SalonVisit that recorded the due-amount collection.
    settledVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SalonVisit' },
    settledAt:    { type: Date },

    note: { type: String },
  },
  { timestamps: true }
);

advanceBookingSchema.index({ eventDate: 1 });
advanceBookingSchema.index({ status: 1 });

module.exports = mongoose.model('AdvanceBooking', advanceBookingSchema);
