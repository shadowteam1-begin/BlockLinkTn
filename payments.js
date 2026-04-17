// routes/payments.js — UPI Donation Payment Routes
//
// POST /api/payments/submit        → donor submits payment + screenshot
// GET  /api/payments/total         → public total raised
// GET  /api/payments/recent        → recent verified donors
// GET  /api/payments/pending       → admin: list pending verifications
// PUT  /api/payments/:id/verify    → admin: approve payment
// PUT  /api/payments/:id/reject    → admin: reject payment
// GET  /api/payments               → admin: all payments

const express = require('express');
const router  = express.Router();
const Payment = require('../models/Payment');
const { protect, authorize } = require('../middleware/auth');

// ══════════════════════════════════════════
// POST /api/payments/submit
// PUBLIC — donor submits payment details + screenshot
// Body: { name, email, phone, amount, message, upiRef, screenshotData, screenshotName }
// ══════════════════════════════════════════
router.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, amount, message, upiRef, screenshotData, screenshotName } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !amount) {
      return res.status(400).json({ success: false, msg: 'Name, email, phone and amount are required' });
    }
    if (!screenshotData) {
      return res.status(400).json({ success: false, msg: 'Payment screenshot is required' });
    }
    if (parseFloat(amount) < 1) {
      return res.status(400).json({ success: false, msg: 'Minimum donation is ₹1' });
    }

    // Check screenshot size (base64 of 5MB = ~6.7MB string)
    if (screenshotData.length > 7 * 1024 * 1024) {
      return res.status(400).json({ success: false, msg: 'Screenshot too large. Please use an image under 5MB.' });
    }

    const payment = await Payment.create({
      donor:          { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() },
      amount:         parseFloat(amount),
      message:        message?.trim() || '',
      upiRef:         upiRef?.trim() || '',
      screenshotData,
      screenshotName: screenshotName || 'screenshot.jpg',
      status:         'pending_verification',
      submittedAt:    new Date(),
    });

    console.log('💳  New UPI donation submitted: ₹' + amount + ' from ' + name + ' <' + email + '>');

    // Notify admin via socket
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('payment:new', {
        id:     payment._id,
        name,
        amount: parseFloat(amount),
        email,
        submittedAt: payment.submittedAt,
      });
    }

    res.status(201).json({
      success:   true,
      paymentId: payment._id,
      msg:       'Thank you! Your payment of ₹' + amount + ' has been submitted for verification. You will receive a confirmation once approved.',
    });

  } catch (err) {
    console.error('Payment submit error:', err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/payments/total  — PUBLIC
// Total verified donations
// ══════════════════════════════════════════
router.get('/total', async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'verified' });
    const total    = payments.reduce((s, p) => s + p.amount, 0);
    res.json({ success: true, total, count: payments.length });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/payments/recent  — PUBLIC
// Recent verified donors (name + amount only)
// ══════════════════════════════════════════
router.get('/recent', async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'verified' })
      .select('donor.name amount message verifiedAt')
      .sort({ verifiedAt: -1 })
      .limit(10);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/payments/pending  — ADMIN
// List payments waiting for verification
// ══════════════════════════════════════════
router.get('/pending', protect, authorize('admin'), async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'pending_verification' })
      .select('-screenshotData')   // don't send large base64 in list view
      .sort({ submittedAt: -1 });
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/payments  — ADMIN
// All payments with pagination
// ══════════════════════════════════════════
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const payments = await Payment.find()
      .select('-screenshotData')
      .sort({ createdAt: -1 })
      .limit(200);
    const total = payments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
    res.json({ success: true, count: payments.length, totalRaised: total, payments });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/payments/:id/screenshot  — ADMIN
// Get screenshot for a specific payment
// ══════════════════════════════════════════
router.get('/:id/screenshot', protect, authorize('admin'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).select('screenshotData screenshotName donor amount');
    if (!payment) return res.status(404).json({ success: false, msg: 'Payment not found' });
    res.json({ success: true, screenshotData: payment.screenshotData, screenshotName: payment.screenshotName, donor: payment.donor, amount: payment.amount });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// PUT /api/payments/:id/verify  — ADMIN
// Approve a payment
// Body: { adminNote? }
// ══════════════════════════════════════════
router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status:     'verified',
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        adminNote:  req.body.adminNote || 'Payment verified by admin',
      },
      { new: true }
    );
    if (!payment) return res.status(404).json({ success: false, msg: 'Payment not found' });

    console.log('✅  Payment verified: ₹' + payment.amount + ' from ' + payment.donor.name);

    // Emit to admin room (update count)
    const io = req.app.get('io');
    if (io) io.to('admin').emit('payment:verified', { id: payment._id, amount: payment.amount });

    res.json({ success: true, msg: '₹' + payment.amount + ' from ' + payment.donor.name + ' verified!', payment });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ══════════════════════════════════════════
// PUT /api/payments/:id/reject  — ADMIN
// Reject a payment
// Body: { adminNote }
// ══════════════════════════════════════════
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status:     'rejected',
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        adminNote:  req.body.adminNote || 'Payment could not be verified',
      },
      { new: true }
    );
    if (!payment) return res.status(404).json({ success: false, msg: 'Payment not found' });

    res.json({ success: true, msg: 'Payment rejected', payment });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

module.exports = router;
