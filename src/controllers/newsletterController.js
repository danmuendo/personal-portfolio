const { validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { sendEmail } = require('../services/email');

// POST /api/newsletter/subscribe
const subscribe = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });

  const { email, name } = req.body;

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (existing) {
      if (existing.isActive)
        return res.json({ success: true, message: 'You are already subscribed!' });
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { isActive: true, name: name || existing.name },
      });
      return res.json({ success: true, message: 'Welcome back! You have been re-subscribed.' });
    }

    await prisma.newsletterSubscriber.create({ data: { email, name } });

    // Welcome email — best effort
    await sendEmail({
      to: email,
      subject: "Welcome to Daniel Muendo's Newsletter!",
      html: `
        <div style="font-family:sans-serif;max-width:600px;background:#050d1a;color:#f0f4ff;padding:32px;border-radius:16px;">
          <h2 style="color:#00e5c8;">You're subscribed! 🎉</h2>
          <p>Hi${name ? ' ' + name : ''},</p>
          <p>Thanks for subscribing. You'll get data tips, course updates and career insights from me directly.</p>
          <p style="color:#5a7090;font-size:12px;margin-top:24px;">
            Don't want to hear from me? 
            <a href="${process.env.FRONTEND_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}" style="color:#5a7090;">Unsubscribe</a>
          </p>
        </div>`,
    });

    res.json({ success: true, message: 'Subscribed successfully! Check your inbox.' });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ success: false, message: 'Subscription failed. Please try again.' });
  }
};

// POST /api/newsletter/unsubscribe
const unsubscribe = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: 'Email required' });
  try {
    await prisma.newsletterSubscriber.updateMany({
      where: { email },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unsubscribe failed.' });
  }
};

module.exports = { subscribe, unsubscribe };
