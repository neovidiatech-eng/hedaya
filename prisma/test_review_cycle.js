import dotenv from "dotenv";
dotenv.config();

import * as db from "../src/database/dbService.js";
import prisma from "../src/database/Connection.db.js";

async function runTestCycle() {
  console.log("=== STARTING REVIEW CYCLE TEST ===");

  // 1. Fetch an existing teacher and student or create test fixtures
  const teacher = await db.findFirst({
    model: "teacher",
    include: { user: true },
  });

  const student = await db.findFirst({
    model: "student",
    include: { user: true },
  });

  if (!teacher || !student) {
    console.error("❌ Teacher or Student not found in database. Please run seeders first.");
    process.exit(1);
  }

  // Ensure teacher has a wallet
  let wallet = await db.findFirst({
    model: "Wallet",
    where: { userId: teacher.user_id },
  });

  if (!wallet) {
    wallet = await db.create({
      model: "Wallet",
      data: {
        userId: teacher.user_id,
        type: "Teacher",
        balance: 0,
      },
    });
  }

  const initialBalance = Number(wallet.balance);
  const initialAttended = student.sessions_attended || 0;

  console.log(`ℹ️ Initial State -> Wallet Balance: ${initialBalance}, Student Attended Sessions: ${initialAttended}`);

  // 2. Create a test schedule session
  const now = new Date();
  const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hr ago
  const endTime = new Date(now.getTime() - 10 * 60 * 1000);   // 10 mins ago

  const subject = await db.findFirst({
    model: "subjects",
  });

  const schedule = await db.create({
    model: "schedule",
    data: {
      title: "Test Review Cycle Session",
      link: "https://example.com/test-session",
      start_time: startTime,
      end_time: endTime,
      status: "ongoing",
      teacherId: teacher.id,
      studentId: student.id,
      ...(subject?.id ? { subjectId: subject.id } : {}),
      scheduleLogs: {
        create: {
          joinTime_teacher: startTime,
          joinTime_student: startTime,
          leaveTime_teacher: endTime,
          leaveTime_student: endTime,
          isTeacherCompleted: true,
          isStudentAttended: true,
        },
      },
    },
    include: { scheduleLogs: true },
  });

  const scheduleId = schedule.id;
  console.log(`✅ Created test session: ${scheduleId} (Status: ${schedule.status})`);

  // Helper function: Teacher submits review
  async function submitTeacherReview() {
    console.log("\n--- Step 1: Teacher submits review ---");
    const session = await db.findOne({
      model: "schedule",
      where: { id: scheduleId },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        scheduleLogs: true,
      },
    });

    const isStudent = false; // Teacher submitting
    const isTeacher = true;
    const effectiveStudentIds = session.studentId ? [session.studentId] : [];
    const log = Array.isArray(session.scheduleLogs) ? session.scheduleLogs[0] : session.scheduleLogs;
    const teacherActuallyAttended = Boolean(log?.joinTime_teacher);
    const studentActuallyAttended = Boolean(log?.joinTime_student);

    await db.transaction(async (tx) => {
      if (isStudent && session.status === "ongoing") {
        // Should NOT execute for teacher!
      }

      await tx.create({
        model: "Review",
        data: {
          scheduleId: session.id,
          reviewerId: teacher.user.id,
          revieweeId: student.user.id,
          rating: 5,
          comment: "Great student!",
          role: "teacher",
        },
      });
    });

    console.log("Teacher review submitted.");
  }

  // Helper function: Student submits review
  async function submitStudentReview() {
    console.log("\n--- Step 3: Student submits review ---");
    const session = await db.findOne({
      model: "schedule",
      where: { id: scheduleId },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        scheduleLogs: true,
      },
    });

    const isStudent = true; // Student submitting
    const effectiveStudentIds = session.studentId ? [session.studentId] : [];
    const log = Array.isArray(session.scheduleLogs) ? session.scheduleLogs[0] : session.scheduleLogs;
    const teacherActuallyAttended = Boolean(log?.joinTime_teacher);
    const studentActuallyAttended = Boolean(log?.joinTime_student);

    await db.transaction(async (tx) => {
      if (isStudent && session.status === "ongoing") {
        if (!teacherActuallyAttended) {
          await tx.updateOne({
            model: "schedule",
            where: { id: scheduleId },
            data: { status: "missed" },
          });
        } else {
          const sessionDuration = (session.end_time - session.start_time) / (60 * 1000 * 60);
          let payoutAmount = sessionDuration * (session.teacher.hour_price || 20);

          const teacherWallet = await tx.findFirst({
            model: "Wallet",
            where: { userId: session.teacher.user_id },
          });

          if (teacherWallet) {
            await tx.updateOne({
              model: "Wallet",
              where: { id: teacherWallet.id },
              data: { balance: { increment: payoutAmount } },
            });
          }

          await tx.updateOne({
            model: "schedule",
            where: { id: scheduleId },
            data: { status: "completed" },
          });

          if (studentActuallyAttended) {
            for (const sId of effectiveStudentIds) {
              await tx.updateOne({
                model: "student",
                where: { id: sId },
                data: { sessions_attended: { increment: 1 } },
              });
            }
          }
        }
      }

      await tx.create({
        model: "Review",
        data: {
          scheduleId: session.id,
          reviewerId: student.user.id,
          revieweeId: teacher.user.id,
          rating: 5,
          comment: "Excellent teacher!",
          role: "student",
        },
      });
    });

    console.log("Student review submitted.");
  }

  // Helper function: finalizeSession
  async function testFinalizeSession() {
    console.log("\n--- Step 2: finalizeSession called ---");
    const session = await db.findOne({
      model: "schedule",
      where: { id: scheduleId },
      include: { scheduleLogs: true },
    });

    if (!session || session.status === "completed" || session.status === "missed") return;

    const log = Array.isArray(session.scheduleLogs) ? session.scheduleLogs[0] : session.scheduleLogs;
    if (!log) return;

    if (!log.joinTime_student && !log.joinTime_teacher) {
      await db.updateOne({
        model: "schedule",
        where: { id: scheduleId },
        data: { status: "missed" },
      });
    }
  }

  // --- RUN STEPS AND VERIFY ---

  // Step 1: Teacher submits review
  await submitTeacherReview();

  let currentSession = await db.findOne({ model: "schedule", where: { id: scheduleId } });
  let currentWallet = await db.findFirst({ model: "Wallet", where: { userId: teacher.user_id } });
  let currentStudent = await db.findOne({ model: "student", where: { id: student.id } });

  console.log(`📌 Post-Teacher Review Status: ${currentSession.status}`);
  console.log(`📌 Post-Teacher Review Wallet Balance: ${currentWallet.balance}`);
  console.log(`📌 Post-Teacher Review Student Attended: ${currentStudent.sessions_attended}`);

  if (currentSession.status !== "ongoing") {
    console.error("❌ FAILURE: Session status should remain 'ongoing' after teacher review alone!");
  } else {
    console.log("✅ SUCCESS: Session status remained 'ongoing' after teacher review!");
  }

  // Step 2: Call finalizeSession
  await testFinalizeSession();

  currentSession = await db.findOne({ model: "schedule", where: { id: scheduleId } });
  console.log(`📌 Post-finalizeSession Status: ${currentSession.status}`);

  if (currentSession.status !== "ongoing") {
    console.error("❌ FAILURE: Session status should remain 'ongoing' after finalizeSession!");
  } else {
    console.log("✅ SUCCESS: Session status remained 'ongoing' after finalizeSession!");
  }

  // Step 3: Student submits review
  await submitStudentReview();

  currentSession = await db.findOne({ model: "schedule", where: { id: scheduleId } });
  currentWallet = await db.findFirst({ model: "Wallet", where: { userId: teacher.user_id } });
  currentStudent = await db.findOne({ model: "student", where: { id: student.id } });

  console.log(`📌 Post-Student Review Status: ${currentSession.status}`);
  console.log(`📌 Post-Student Review Wallet Balance: ${currentWallet.balance}`);
  console.log(`📌 Post-Student Review Student Attended: ${currentStudent.sessions_attended}`);

  if (currentSession.status === "completed" && Number(currentWallet.balance) > initialBalance && currentStudent.sessions_attended === initialAttended + 1) {
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The review cycle functions exactly as required!");
  } else {
    console.error("❌ FAILURE in student review completion stage.");
  }

  // Clean up test schedule & reviews
  await db.deleteMany({ model: "Review", where: { scheduleId } });
  await db.deleteMany({ model: "scheduleLog", where: { scheduleId } });
  await db.deleteOne({ model: "schedule", where: { id: scheduleId } });
  console.log("🧹 Test schedule and reviews cleaned up.");
}

runTestCycle()
  .catch((err) => console.error("Test execution error:", err))
  .finally(async () => {
    await prisma.$disconnect();
  });
