// models/Payment.js — UPI Donation + Admin Verification
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  donor: {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  amount:         { type: Number, required: true, min: 1 },
  currency:       { type: String, default: 'INR' },
  message:        { type: String, trim: true },
  upiId:          { type: String, default: 'mohammedarif270306@oksbi' },
  upiRef:         { type: String, trim: true },
  screenshotData: { type: String },   // base64 data URL
  screenshotName: { type: String },
  status: {
    type:    String,
    enum:    ['pending_verification', 'verified', 'rejected'],
    default: 'pending_verification',
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  adminNote:  { type: String, trim: true },
  submittedAt:{ type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
