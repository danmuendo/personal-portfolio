const nodemailer = require('nodemailer');

const escape = (s) => !s ? '' : String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Email skipped — SMTP not configured');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Daniel Muendo" <${process.env.SMTP_USER}>`,
      to, subject, html,
      text: html.replace(/<[^>]*>/g, ''),
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('Email error:', err.message);
    // Don't throw — email failure shouldn't crash the request
  }
};

const sendContactNotification = ({ name, email, subject, message }) =>
  sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
    subject: `📬 New Contact: ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#00e5c8;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escape(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escape(email)}">${escape(email)}</a></p>
        <p><strong>Subject:</strong> ${escape(subject)}</p>
        <p><strong>Message:</strong><br>${escape(message).replace(/\n/g, '<br>')}</p>
        <a href="mailto:${escape(email)}?subject=Re: ${escape(subject)}"
           style="background:#00e5c8;color:#050d1a;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:16px;">
          Reply →
        </a>
      </div>`
  });

const sendEnrollmentConfirmation = ({ userName, userEmail, courseName, courseSlug }) =>
  sendEmail({
    to: userEmail,
    subject: `🎉 You're enrolled in ${courseName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;background:#050d1a;color:#f0f4ff;padding:32px;border-radius:16px;">
        <h2 style="color:#00e5c8;">Welcome to ${escape(courseName)}!</h2>
        <p>Hi ${escape(userName)}, you're officially enrolled. Let's get started! 🚀</p>
        <a href="${process.env.FRONTEND_URL}#courses"
           style="background:#00e5c8;color:#050d1a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:16px;">
          Start Learning →
        </a>
      </div>`
  });

const sendCertificateEmail = ({ userName, userEmail, courseName, certNumber }) =>
  sendEmail({
    to: userEmail,
    subject: `🏅 Certificate of Completion — ${courseName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;background:#050d1a;color:#f0f4ff;padding:32px;border-radius:16px;text-align:center;">
        <div style="font-size:48px;">🏅</div>
        <h1 style="color:#ffd166;">Certificate of Completion</h1>
        <p>This certifies that <strong style="color:#00e5c8;">${escape(userName)}</strong>
        has successfully completed <strong style="color:#ff6b35;">${escape(courseName)}</strong></p>
        <p style="color:#5a7090;font-size:12px;">Certificate No: ${escape(certNumber)}</p>
        <a href="${process.env.FRONTEND_URL}/certificate/${certNumber}"
           style="background:#00e5c8;color:#050d1a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:16px;">
          View Certificate →
        </a>
      </div>`
  });

module.exports = { sendEmail, sendContactNotification, sendEnrollmentConfirmation, sendCertificateEmail };
