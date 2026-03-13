const express = require('express');
const router = express.Router();
const {
  getStats, getContacts, getSubscribers, getPayments, sendNewsletter,
  getUsers, updateUserRole, deleteUser,
  getCourses, createCourse, updateCourse, deleteCourse, togglePublish,
  getBlogs, createBlog, updateBlog, deleteBlog,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// Stats & messages
router.get('/stats', getStats);
router.get('/messages', getContacts);
router.get('/contacts', getContacts);
router.get('/subscribers', getSubscribers);
router.get('/payments', getPayments);
router.post('/newsletter/send', sendNewsletter);

// Users
router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Courses
router.get('/courses', getCourses);
router.post('/courses', createCourse);
router.patch('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.patch('/courses/:id/publish', togglePublish);

// Blogs
router.get('/blogs', getBlogs);
router.post('/blogs', createBlog);
router.patch('/blogs/:id', updateBlog);
router.delete('/blogs/:id', deleteBlog);

module.exports = router;
