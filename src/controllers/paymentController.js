const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { sendEnrollmentConfirmation } = require('../services/email');

const enrollUser = async (userId, courseId) => {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  });
};

// POST /api/payments/stripe/create-session
const createStripeSession = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });

  const { courseId } = req.body;
  const userId = req.user.id;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (enrolled)
      return res.status(400).json({ success: false, message: 'Already enrolled in this course' });

    const payment = await prisma.payment.create({
      data: { userId, courseId, amount: course.price, currency: 'KES', method: 'STRIPE', status: 'PENDING' },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: (process.env.STRIPE_CURRENCY || 'kes').toLowerCase(),
          product_data: { name: course.title, description: course.description },
          unit_amount: Math.round(course.price * 100),
        },
        quantity: 1,
      }],
      metadata: { paymentId: payment.id, userId, courseId },
      success_url: `${process.env.FRONTEND_URL}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}?payment=cancelled`,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    res.json({ success: true, sessionUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment session' });
  }
};

// POST /api/payments/webhook/stripe
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { paymentId, userId, courseId } = session.metadata;
    try {
      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'COMPLETED' } });
      await enrollUser(userId, courseId);

      const [user, course] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
        prisma.course.findUnique({ where: { id: courseId }, select: { title: true, slug: true } }),
      ]);
      if (user && course)
        await sendEnrollmentConfirmation({ userName: user.name, userEmail: user.email, courseName: course.title, courseSlug: course.slug });
    } catch (err) {
      console.error('Stripe webhook processing error:', err);
    }
  }
  res.json({ received: true });
};

// POST /api/payments/mpesa/initiate
const initiateMpesa = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });

  const { courseId, phone } = req.body;
  const userId = req.user.id;

  if (!process.env.INTASEND_PUBLISHABLE_KEY || !process.env.INTASEND_SECRET_KEY)
    return res.status(503).json({ success: false, message: 'M-Pesa is not configured on this server.' });

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (enrolled)
      return res.status(400).json({ success: false, message: 'Already enrolled in this course' });

    const payment = await prisma.payment.create({
      data: { userId, courseId, amount: course.price, currency: 'KES', method: 'MPESA', status: 'PENDING' },
    });

    // Format phone: 07xx → 2547xx, 01xx → 2541xx
    const formattedPhone = phone.replace(/^\+/, '').replace(/^0/, '254');

    const IntaSend = require('intasend-node');
    const intasend = new IntaSend(
      process.env.INTASEND_PUBLISHABLE_KEY,
      process.env.INTASEND_SECRET_KEY,
      process.env.INTASEND_TEST_MODE === 'true'
    );
    const collection = intasend.collection();
    const response = await collection.mpesaStkPush({
      first_name: req.user.name.split(' ')[0],
      last_name: req.user.name.split(' ').slice(1).join(' ') || '-',
      email: req.user.email,
      host: process.env.FRONTEND_URL,
      amount: Math.round(course.price),
      phone_number: formattedPhone,
      api_ref: payment.id,
      narrative: `Enrollment: ${course.title}`,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { mpesaCheckoutId: response.id, mpesaRef: response.invoice_id || response.id },
    });

    res.json({
      success: true,
      message: 'M-Pesa prompt sent to your phone. Enter your PIN to complete.',
      paymentId: payment.id,
    });
  } catch (err) {
    console.error('M-Pesa error:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate M-Pesa payment. Please try again.' });
  }
};

// GET /api/payments/mpesa/status/:paymentId
const checkMpesaStatus = async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId: req.user.id },
      include: { course: { select: { title: true, slug: true } } },
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    // If already completed just return
    if (payment.status === 'COMPLETED')
      return res.json({ success: true, status: 'COMPLETED', message: 'Payment confirmed!' });

    // Poll Intasend for status
    if (payment.mpesaCheckoutId && process.env.INTASEND_PUBLISHABLE_KEY) {
      try {
        const IntaSend = require('intasend-node');
        const intasend = new IntaSend(
          process.env.INTASEND_PUBLISHABLE_KEY,
          process.env.INTASEND_SECRET_KEY,
          process.env.INTASEND_TEST_MODE === 'true'
        );
        const statusRes = await intasend.collection().status(payment.mpesaCheckoutId);
        const state = statusRes?.invoice?.state;

        if (state === 'COMPLETE') {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });
          await enrollUser(payment.userId, payment.courseId);

          const user = await prisma.user.findUnique({ where: { id: payment.userId }, select: { name: true, email: true } });
          if (user)
            await sendEnrollmentConfirmation({ userName: user.name, userEmail: user.email, courseName: payment.course.title, courseSlug: payment.course.slug });

          return res.json({ success: true, status: 'COMPLETED', message: 'Payment confirmed!' });
        }
        if (state === 'FAILED' || state === 'CANCELLED') {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
          return res.json({ success: false, status: 'FAILED', message: 'Payment failed or cancelled.' });
        }
      } catch (intasendErr) {
        console.error('Intasend status error:', intasendErr.message);
      }
    }

    res.json({ success: true, status: payment.status, message: 'Waiting for confirmation...' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check payment status' });
  }
};

// POST /api/payments/webhook/mpesa (Intasend callback)
const mpesaWebhook = async (req, res) => {
  try {
    const { invoice } = req.body;
    if (!invoice) return res.json({ success: true });

    const payment = await prisma.payment.findFirst({ where: { mpesaCheckoutId: invoice.id } });
    if (!payment) return res.json({ success: true });

    if (invoice.state === 'COMPLETE' && payment.status !== 'COMPLETED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });
      await enrollUser(payment.userId, payment.courseId);

      const [user, course] = await Promise.all([
        prisma.user.findUnique({ where: { id: payment.userId }, select: { name: true, email: true } }),
        prisma.course.findUnique({ where: { id: payment.courseId }, select: { title: true, slug: true } }),
      ]);
      if (user && course)
        await sendEnrollmentConfirmation({ userName: user.name, userEmail: user.email, courseName: course.title, courseSlug: course.slug });
    }
  } catch (err) {
    console.error('M-Pesa webhook error:', err);
  }
  res.json({ success: true }); // Always 200 to Intasend
};

// GET /api/payments/my-payments
const getMyPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      include: { course: { select: { title: true, slug: true, iconEmoji: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get payments' });
  }
};

module.exports = { createStripeSession, stripeWebhook, initiateMpesa, checkMpesaStatus, mpesaWebhook, getMyPayments };
