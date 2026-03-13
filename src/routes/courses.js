const express = require('express');
const router = express.Router();
const { getAllCourses, getCourse, getLesson } = require('../controllers/courseController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', getAllCourses);
router.get('/:slug', optionalAuth, getCourse);
router.get('/:slug/lesson/:lessonId', optionalAuth, getLesson);

module.exports = router;
