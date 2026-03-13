const prisma = require('../services/prisma');
const { sendEmail } = require('../services/email');

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [users, enrollments, revenue, subscribers, courses, unreadMessages] = await Promise.all([
      prisma.user.count(),
      prisma.enrollment.count(),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      prisma.course.count({ where: { isPublished: true } }),
      prisma.contactSubmission.count(),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: users,
        totalEnrollments: enrollments,
        totalRevenue: revenue._sum.amount || 0,
        activeSubscribers: subscribers,
        publishedCourses: courses,
        unreadMessages,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

// GET /api/admin/messages  (also aliased as /contacts in route)
const getContacts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  try {
    const [messages, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contactSubmission.count(),
    ]);
    res.json({ success: true, messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
};

// GET /api/admin/subscribers
const getSubscribers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  try {
    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where: { isActive: true },
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    ]);
    res.json({ success: true, subscribers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get subscribers' });
  }
};

// GET /api/admin/payments
const getPayments = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  try {
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count(),
    ]);
    res.json({ success: true, payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get payments' });
  }
};

// POST /api/admin/newsletter/send  — blast email to all active subscribers
const sendNewsletter = async (req, res) => {
  const { subject, html } = req.body;
  if (!subject || !html)
    return res.status(400).json({ success: false, message: 'subject and html are required' });

  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({ where: { isActive: true } });
    if (!subscribers.length)
      return res.json({ success: true, message: 'No active subscribers.', sent: 0 });

    let sent = 0;
    for (const sub of subscribers) {
      await sendEmail({ to: sub.email, subject, html });
      sent++;
    }
    res.json({ success: true, message: `Newsletter sent to ${sent} subscribers.`, sent });
  } catch (err) {
    console.error('Newsletter send error:', err);
    res.status(500).json({ success: false, message: 'Failed to send newsletter' });
  }
};

module.exports = { getStats, getContacts, getSubscribers, getPayments, sendNewsletter };
