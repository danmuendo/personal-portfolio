const prisma = require('../services/prisma');

// GET /api/courses
const getAllCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      include: { _count: { select: { lessons: true, enrollments: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
};

// GET /api/courses/:slug
const getCourse = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { slug: req.params.slug },
      include: {
        lessons: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });

    if (!course || !course.isPublished)
      return res.status(404).json({ success: false, message: 'Course not found' });

    const userId = req.user?.userId || req.user?.id;
    let isEnrolled = false;
    if (userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      isEnrolled = !!enrollment;
    }

    // Hide locked content from non-enrolled users
    const lessons = course.lessons.map((l) => ({
      ...l,
      content: isEnrolled || l.isFree ? l.content : null,
      videoUrl: isEnrolled || l.isFree ? l.videoUrl : null,
    }));

    res.json({ success: true, course: { ...course, lessons }, isEnrolled });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch course' });
  }
};

// GET /api/courses/:slug/lesson/:lessonId
const getLesson = async (req, res) => {
  const { lessonId } = req.params;
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

    if (!lesson.isFree) {
      const userId = req.user?.userId || req.user?.id;
      if (!userId)
        return res.status(401).json({ success: false, message: 'Login required' });

      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: lesson.courseId } },
      });
      if (!enrollment)
        return res.status(403).json({ success: false, message: 'Enroll in this course to access this lesson' });
    }

    res.json({ success: true, lesson });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch lesson' });
  }
};

module.exports = { getAllCourses, getCourse, getLesson };
