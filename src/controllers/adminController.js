const prisma = require('../services/prisma');
const { sendEmail } = require('../services/email');

// ─── STATS ───────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [users, enrollments, revenue, subscribers, courses, messages] = await Promise.all([
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
        totalUsers: users, totalEnrollments: enrollments,
        totalRevenue: revenue._sum.amount || 0,
        activeSubscribers: subscribers, publishedCourses: courses, unreadMessages: messages,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get stats' }); }
};

const getContacts = async (req, res) => {
  try {
    const messages = await prisma.contactSubmission.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, messages });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get messages' }); }
};

const getSubscribers = async (req, res) => {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({ where: { isActive: true }, orderBy: { subscribedAt: 'desc' } });
    res.json({ success: true, subscribers });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get subscribers' }); }
};

const getPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { user: { select: { name: true, email: true } }, course: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, payments });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get payments' }); }
};

const sendNewsletter = async (req, res) => {
  const { subject, html } = req.body;
  if (!subject || !html) return res.status(400).json({ success: false, message: 'subject and html required' });
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({ where: { isActive: true } });
    let sent = 0;
    for (const sub of subscribers) { await sendEmail({ to: sub.email, subject, html }); sent++; }
    res.json({ success: true, message: `Sent to ${sent} subscribers.`, sent });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to send newsletter' }); }
};

// ─── USERS ───────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isVerified: true, createdAt: true, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get users' }); }
};

const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['STUDENT', 'ADMIN'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'Cannot change your own role' });
  try {
    const user = await prisma.user.update({ where: { id }, data: { role } });
    res.json({ success: true, message: `${user.name} is now ${role}`, user });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update role' }); }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete user' }); }
};

// ─── COURSES ─────────────────────────────────────────────
const getCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: { _count: { select: { enrollments: true, lessons: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, courses });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get courses' }); }
};

const createCourse = async (req, res) => {
  const { slug, title, description, level, price, origPrice, duration, iconEmoji, currency } = req.body;
  if (!slug || !title || !description || !price)
    return res.status(400).json({ success: false, message: 'slug, title, description, price required' });
  try {
    const course = await prisma.course.create({
      data: { slug, title, description, level: level || 'BEGINNER', price: parseFloat(price),
        origPrice: origPrice ? parseFloat(origPrice) : null, duration: duration || '',
        iconEmoji: iconEmoji || '📊', currency: currency || 'KES', isPublished: false },
    });
    res.status(201).json({ success: true, message: 'Course created', course });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Slug already exists' });
    res.status(500).json({ success: false, message: 'Failed to create course' });
  }
};

const updateCourse = async (req, res) => {
  const { id } = req.params;
  const { title, description, level, price, origPrice, duration, iconEmoji } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(title && { title }), ...(description && { description }), ...(level && { level }),
        ...(price && { price: parseFloat(price) }),
        ...(origPrice !== undefined && { origPrice: origPrice ? parseFloat(origPrice) : null }),
        ...(duration && { duration }), ...(iconEmoji && { iconEmoji }),
      },
    });
    res.json({ success: true, message: 'Course updated', course });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update course' }); }
};

const deleteCourse = async (req, res) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Course deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete course' }); }
};

const togglePublish = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const updated = await prisma.course.update({ where: { id: req.params.id }, data: { isPublished: !course.isPublished } });
    res.json({ success: true, message: `Course ${updated.isPublished ? 'published' : 'unpublished'}`, course: updated });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to toggle publish' }); }
};

// ─── BLOGS ───────────────────────────────────────────────
const getBlogs = async (req, res) => {
  try {
    const blogs = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, blogs });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to get blogs' }); }
};

const createBlog = async (req, res) => {
  const { slug, title, excerpt, content, category, readTime, coverEmoji, isPublished } = req.body;
  if (!slug || !title || !excerpt || !content)
    return res.status(400).json({ success: false, message: 'slug, title, excerpt, content required' });
  try {
    const blog = await prisma.blogPost.create({
      data: { slug, title, excerpt, content, category: category || 'Data Analytics',
        readTime: readTime || '5 min read', coverEmoji: coverEmoji || '📊',
        isPublished: !!isPublished, publishedAt: isPublished ? new Date() : null },
    });
    res.status(201).json({ success: true, message: 'Blog post created', blog });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Slug already exists' });
    res.status(500).json({ success: false, message: 'Failed to create blog' });
  }
};

const updateBlog = async (req, res) => {
  const { id } = req.params;
  const { title, excerpt, content, category, readTime, coverEmoji, isPublished } = req.body;
  try {
    const blog = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(title && { title }), ...(excerpt && { excerpt }), ...(content && { content }),
        ...(category && { category }), ...(readTime && { readTime }), ...(coverEmoji && { coverEmoji }),
        ...(isPublished !== undefined && { isPublished, publishedAt: isPublished ? new Date() : null }),
      },
    });
    res.json({ success: true, message: 'Blog updated', blog });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update blog' }); }
};

const deleteBlog = async (req, res) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Blog deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete blog' }); }
};

module.exports = {
  getStats, getContacts, getSubscribers, getPayments, sendNewsletter,
  getUsers, updateUserRole, deleteUser,
  getCourses, createCourse, updateCourse, deleteCourse, togglePublish,
  getBlogs, createBlog, updateBlog, deleteBlog,
};
