const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Admin user ──────────────────────────────────────────
  const hash = await bcrypt.hash('ChangeMe123!', 12);
  await prisma.user.upsert({
    where: { email: 'danmuendo4@gmail.com' },
    update: {},
    create: {
      name: 'Daniel Muendo',
      email: 'danmuendo4@gmail.com',
      password: hash,
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('✅ Admin: danmuendo4@gmail.com  /  ChangeMe123!');

  // ── Courses ─────────────────────────────────────────────
  const courses = [
    {
      slug: 'sql-for-data-analysts',
      title: 'SQL for Data Analysts',
      description: 'Master SQL from basic queries to advanced window functions and CTEs using real healthcare and retail datasets. By the end you will be able to answer any ad-hoc data question with confidence.',
      level: 'BEGINNER',
      price: 3499,
      origPrice: 5999,
      duration: '12 hrs',
      iconEmoji: '🗄️',
      rating: 4.9,
    },
    {
      slug: 'power-bi-zero-to-dashboard',
      title: 'Power BI: Zero to Dashboard',
      description: 'Build stunning Power BI dashboards from scratch — data modelling, relationships, DAX measures, and publishing to Power BI Service.',
      level: 'BEGINNER',
      price: 4499,
      origPrice: 6999,
      duration: '15 hrs',
      iconEmoji: '📊',
      rating: 4.8,
    },
    {
      slug: 'excel-mastery-vba',
      title: 'Excel Mastery & VBA Automation',
      description: 'Pivot Tables, Power Query, advanced formulas, and VBA macros to automate repetitive reporting tasks and save hours every month.',
      level: 'BEGINNER',
      price: 2999,
      origPrice: null,
      duration: '10 hrs',
      iconEmoji: '📗',
      rating: 4.9,
    },
    {
      slug: 'data-validation-reconciliation',
      title: 'Data Validation & Reconciliation',
      description: 'Catch data quality problems before they reach stakeholders. Covers profiling, validation rules, reconciliation frameworks in SQL and Excel.',
      level: 'INTERMEDIATE',
      price: 3999,
      origPrice: 5499,
      duration: '9 hrs',
      iconEmoji: '🔍',
      rating: 4.8,
    },
    {
      slug: 'tableau-business-reporting',
      title: 'Tableau for Business Reporting',
      description: 'Build compelling, interactive Tableau dashboards designed for executive stakeholders, with best practices for visual design and storytelling.',
      level: 'INTERMEDIATE',
      price: 4199,
      origPrice: 5999,
      duration: '11 hrs',
      iconEmoji: '📈',
      rating: 4.7,
    },
  ];

  for (const courseData of courses) {
    const course = await prisma.course.upsert({
      where: { slug: courseData.slug },
      update: {},
      create: { ...courseData, isPublished: true },
    });

    // Delete existing lessons before re-seeding (safe for dev)
    await prisma.lesson.deleteMany({ where: { courseId: course.id } });

    const lessons = [
      { title: 'Welcome & What You Will Build', order: 1, isFree: true, duration: 5 },
      { title: 'Setting Up Your Environment', order: 2, isFree: true, duration: 10 },
      { title: 'Core Concepts — Part 1', order: 3, isFree: false, duration: 20 },
      { title: 'Core Concepts — Part 2', order: 4, isFree: false, duration: 25 },
      { title: 'Guided Hands-On Exercise', order: 5, isFree: false, duration: 30 },
      { title: 'Real-World Project', order: 6, isFree: false, duration: 45 },
      { title: 'Recap & Next Steps', order: 7, isFree: false, duration: 10 },
    ];

    for (const lesson of lessons) {
      await prisma.lesson.create({ data: { ...lesson, courseId: course.id } });
    }

    console.log(`✅ ${course.title}  (${lessons.length} lessons)`);
  }

  console.log('\n🎉 Seed complete!');
  console.log('⚠️  Remember to change the admin password after first login.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
