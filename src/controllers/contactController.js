const { validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { sendContactNotification } = require('../services/email');

// POST /api/contact
const submitContact = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });

  const { firstName, lastName, name, email, subject, message } = req.body;
  const fullName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Anonymous';

  try {
    await prisma.contactSubmission.create({
      data: { name: fullName, email, subject, message },
    });

    // Best-effort — never crash if email fails
    await sendContactNotification({ name: fullName, email, subject, message });

    res.json({ success: true, message: 'Message sent successfully. I will get back to you soon!' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
};

module.exports = { submitContact };
