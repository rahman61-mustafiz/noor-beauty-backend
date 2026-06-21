const mongoose = require('mongoose');

// Each selected service is snapshotted (name + price) at the moment of the visit,
// so historical records stay correct even if a Service price changes later.
const lineItemSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name:    { type: String, required: true, trim: true },
    price:   { type: Number, required: true },
  },
  { _id: false }
);

// A single visit's payment can be split across methods (e.g. part cash, part
// bkash, part card). Amounts sum to finalAmount.
const paymentSplitSchema = new mongoose.Schema(
  {
    cash:  { type: Number, default: 0 },
    bkash: { type: Number, default: 0 },
    card:  { type: Number, default: 0 },
  },
  { _id: false }
);

const salonVisitSchema = new mongoose.Schema(
  {
    // Customer info is denormalized so a visit is self-contained.
    customerName:    { type: String, required: true, trim: true },
    customerPhone:   { type: String, trim: true },
    customerSource:  { type: String, enum: ['app', 'walkin'], default: 'walkin' },

    items:           { type: [lineItemSchema], default: [] },

    // Multiple beauticians can work on one visit. Work credit is split equally
    // across this array in reports (based on finalAmount).
    staff:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],

    subtotal:        { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    finalAmount:     { type: Number, required: true, default: 0 },

    // Split payment breakdown (cash + bkash + card === finalAmount).
    payments:        { type: paymentSplitSchema, default: () => ({ cash: 0, bkash: 0, card: 0 }) },
    // Kept for backward compatibility / legacy displays: the dominant method.
    paymentMethod:   { type: String, enum: ['cash', 'bkash', 'card'], default: 'cash' },
    source:          { type: String, default: 'tablet' },
    date:            { type: Date, default: Date.now },
    note:            { type: String },
  },
  { timestamps: true }
);

salonVisitSchema.index({ date: -1 });
salonVisitSchema.index({ customerPhone: 1 });

module.exports = mongoose.model('SalonVisit', salonVisitSchema);
