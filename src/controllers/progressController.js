const crypto = require('crypto');
const prisma = require('../services/prisma');
const { sendCertificateEmail } = require('../services/email');

// GET /api/progress/:courseId
const getCourseProgress = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        progress: {
          include: { lesson: { select: { id: true, title: true, order: true } } },
        },
        course: {
          include: { lessons: { select: { id: true }, orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!enrollment)
      return res.status(404).json({ success: false, message: 'Not enrolled in this course' });

    const totalLessons = enrollment.course.lessons.length;
    const completedLessons = enrollment.progress.length;
    const percentage = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    res.json({
      success: true,
      progress: {
        totalLessons,
        completedLessons,
        percentage,
        completed: enrollment.progress.map((p) => p.lesson),
        completedAt: enrollment.completedAt,
        status: enrollment.status,
      },
    });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ success: false, message: 'Failed to get progress' });
  }
};

// POST /api/progress/:courseId/lesson/:lessonId/complete
const completeLesson = async (req, res) => {
  const { courseId, lessonId } = req.params;
  const userId = req.user.id;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: { include: { lessons: { select: { id: true } } } } },
    });

    if (!enrollment)
      return res.status(404).json({ success: false, message: 'Not enrolled in this course' });

    // Mark lesson complete (idempotent)
    await prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
      create: { enrollmentId: enrollment.id, lessonId },
      update: {},
    });

    const totalLessons = enrollment.course.lessons.length;
    const completedCount = await prisma.lessonProgress.count({
      where: { enrollmentId: enrollment.id },
    });
    const isComplete = completedCount >= totalLessons;

    let certificate = null;

    if (isComplete && !enrollment.completedAt) {
      // Mark course complete
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { completedAt: new Date(), status: 'COMPLETED' },
      });

      // Issue certificate
      const certNo = `DM-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      certificate = await prisma.certificate.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, certificateNo: certNo },
        update: {},
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (user) {
        await sendCertificateEmail({
          userName: user.name,
          userEmail: user.email,
          courseName: enrollment.course.title,
          certNumber: certificate.certificateNo,
        });
      }
    }

    res.json({
      success: true,
      message: isComplete ? '🎉 Course completed! Your certificate has been issued.' : 'Lesson marked complete.',
      isComplete,
      completedLessons: completedCount,
      totalLessons,
      percentage: Math.round((completedCount / totalLessons) * 100),
      certificate: certificate
        ? { certNumber: certificate.certificateNo, issuedAt: certificate.issuedAt }
        : null,
    });
  } catch (err) {
    console.error('Complete lesson error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark lesson complete' });
  }
};

// GET /api/progress/certificate/:certNumber  (public — shareable)
const getCertificate = async (req, res) => {
  const { certNumber } = req.params;
  try {
    const cert = await prisma.certificate.findUnique({
      where: { certificateNo: certNumber },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });
    if (!cert)
      return res.status(404).json({ success: false, message: 'Certificate not found' });

    res.json({
      success: true,
      certificate: {
        certNumber: cert.certificateNo,
        issuedAt: cert.issuedAt,
        studentName: cert.user.name,
        courseName: cert.course.title,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get certificate' });
  }
};

module.exports = { getCourseProgress, completeLesson, getCertificate };
