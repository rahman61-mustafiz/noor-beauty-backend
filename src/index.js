const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    customerName:  { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    serviceName:   { type: String, trim: true },
    amount:        { type: Number, required: true },
    date:          { type: Date, default: Date.now },
    note:          { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LedgerEntry', ledgerSchema);