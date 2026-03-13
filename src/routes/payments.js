const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  createStripeSession,
  stripeWebhook,
  initiateMpesa,
  checkMpesaStatus,
  mpesaWebhook,
  getMyPayments,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Webhooks — no auth, no JSON body needed (raw body set in index.js for Stripe)
router.post('/webhook/stripe', stripeWebhook);
router.post('/webhook/mpesa', mpesaWebhook);

// Protected
router.post(
  '/stripe/create-session',
  protect,
  body('courseId').isUUID().withMessage('Valid course ID required'),
  createStripeSession
);
router.post(
  '/mpesa/initiate',
  protect,
  body('courseId').isUUID().withMessage('Valid course ID required'),
  body('phone').notEmpty().withMessage('Phone number required'),
  initiateMpesa
);
router.get('/mpesa/status/:paymentId', protect, checkMpesaStatus);
router.get('/my-payments', protect, getMyPayments);

module.exports = router;
