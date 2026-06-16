const mongoose = require('mongoose');

// Flexible key-value store for admin-controlled settings.
// Used now for the discount cap (key: 'discountCapPercent') and panel toggles
// (e.g. 'showDiscountOnReceipt'). Easy to extend later without schema changes.
const settingsSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Convenience helpers: Settings.get('discountCapPercent', 20)
settingsSchema.statics.get = async function (key, fallback = null) {
  const doc = await this.findOne({ key }).lean();
  return doc && doc.value != null ? doc.value : fallback;
};

settingsSchema.statics.set = async function (key, value) {
  return this.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
