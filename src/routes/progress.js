const express = require('express');
const router = express.Router();
const { getCourseProgress, completeLesson, getCertificate } = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

// Public — shareable certificate page
router.get('/certificate/:certNumber', getCertificate);

// Protected
router.get('/:courseId', protect, getCourseProgress);
router.post('/:courseId/lesson/:lessonId/complete', protect, completeLesson);

module.exports = router;
