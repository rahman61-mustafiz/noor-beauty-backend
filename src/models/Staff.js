const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    phone:       { type: String },
    specialty:   { type: [String], default: [] },
    bio:         { type: String },
    photoUrl:    { type: String },
    rating:      { type: Number, default: 0 },
    salary:      { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
    workingDays: { type: [String], default: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    workStart:   { type: String, default: '10:00' },
    workEnd:     { type: String, default: '20:00' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Staff || mongoose.model('Staff', staffSchema);
