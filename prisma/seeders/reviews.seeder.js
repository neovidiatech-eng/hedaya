import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function seedReviews() {
  console.log("--- Seeding Reviews ---");

  const completedSchedules = await prisma.schedule.findMany({
    take: 10,
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
    },
  });

  if (completedSchedules.length === 0) {
    console.log("No schedules found for seeding reviews.");
    return;
  }

  const sampleComments = [
    "شرح ممتاز وجلسة مفيدة جداً",
    "معلم متمكن وشرح وافي",
    "طالب مجتهد وملتزم بالوقت",
    "جلسة تفاعلية ورائعة جداً",
    "توصية ممتازة وشرح تبسيطي رائع",
  ];

  for (const schedule of completedSchedules) {
    if (!schedule.teacher?.user || !schedule.student?.user) continue;

    // Student reviews teacher
    const existingStudentReview = await prisma.review.findFirst({
      where: {
        scheduleId: schedule.id,
        reviewerId: schedule.student.user.id,
      },
    });

    if (!existingStudentReview) {
      const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5
      await prisma.review.create({
        data: {
          scheduleId: schedule.id,
          reviewerId: schedule.student.user.id,
          revieweeId: schedule.teacher.user.id,
          rating,
          comment: sampleComments[Math.floor(Math.random() * sampleComments.length)],
          role: "student",
        },
      });
    }

    // Teacher reviews student
    const existingTeacherReview = await prisma.review.findFirst({
      where: {
        scheduleId: schedule.id,
        reviewerId: schedule.teacher.user.id,
      },
    });

    if (!existingTeacherReview) {
      const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5
      await prisma.review.create({
        data: {
          scheduleId: schedule.id,
          reviewerId: schedule.teacher.user.id,
          revieweeId: schedule.student.user.id,
          rating,
          comment: sampleComments[Math.floor(Math.random() * sampleComments.length)],
          role: "teacher",
        },
      });
    }
  }

  // Recalculate average ratings for teachers
  const teachers = await prisma.teacher.findMany({ include: { user: true } });
  for (const t of teachers) {
    if (!t.user) continue;
    const reviews = await prisma.review.findMany({
      where: { revieweeId: t.user.id, isHidden: false },
    });
    if (reviews.length > 0) {
      const total = reviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = total / reviews.length;
      await prisma.teacher.update({
        where: { id: t.id },
        data: { avgRating: avg, totalReviews: reviews.length },
      });
    }
  }

  // Recalculate average ratings for students
  const students = await prisma.student.findMany({ include: { user: true } });
  for (const s of students) {
    if (!s.user) continue;
    const reviews = await prisma.review.findMany({
      where: { revieweeId: s.user.id, isHidden: false },
    });
    if (reviews.length > 0) {
      const total = reviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = total / reviews.length;
      await prisma.student.update({
        where: { id: s.id },
        data: { avgRating: avg, totalReviews: reviews.length },
      });
    }
  }

  console.log("--- Reviews Seeding Finished ---");
}

if (process.argv[1]?.endsWith("reviews.seeder.js")) {
  seedReviews()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
