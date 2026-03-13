const express = require('express');
const router = express.Router();
const { getStats, getContacts, getSubscribers, getPayments, sendNewsletter } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/messages', getContacts);   // frontend calls /messages
router.get('/contacts', getContacts);   // alias
router.get('/subscribers', getSubscribers);
router.get('/payments', getPayments);
router.post('/newsletter/send', sendNewsletter);

module.exports = router;
