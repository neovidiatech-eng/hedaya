import cron from "node-cron";
import * as db from "../../database/dbService.js";
import { createNotification, createAdminNotification } from "../../Modules/Notifications/notifications.controller.js";

const deleteSoftDeletedMessages = () => {
     // Runs daily at midnight — deletes messages where deletedAt is 30+ days ago
     cron.schedule("0 0 * * *", async () => {
          try {
               const thirtyDaysAgo = new Date();
               thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

               console.log(`[Cron] Hard deleting messages soft-deleted before ${thirtyDaysAgo.toISOString()}...`);

               const result = await db.deleteMany({
                    model: "Message",
                    where: {
                         deletedAt: {
                              not: null,
                              lte: thirtyDaysAgo, 
                         },
                    },
               });
               console.log(`[Cron] Done — ${result.count} messages permanently deleted.`);
          } catch (error) {
               console.error("[Cron] Error in deleteSoftDeletedMessages:", error);
          }
     });
};

/**
 * Cron Job: Finalize expired sessions
 *
 * Runs every minute. Finds all sessions whose end_time has passed
 * and whose status is still "scheduled", "planned", or "ongoing".
 *
 * Two outcome paths:
 *
 *  A) BOTH teacher & student joined (ongoing) → 20-min grace period for feedback.
 *     After grace period → auto "completed" + teacher payout + sessions_attended++
 *
 *  B) One or both absent → immediately "missed"
 *     - Teacher absent  → refund session to student(s)
 *     - Student absent  → no refund
 *     - Both absent     → no refund
 */
const FEEDBACK_GRACE_MINUTES = 20;

const markMissedSessions = () => {
     cron.schedule("* * * * *", async () => {
          try {
               const now = new Date();

               // Fetch all sessions that have ended but are not yet finalized
               const expiredSessions = await db.findMany({
                    model: "schedule",
                    where: {
                         end_time: { lte: now },
                         status: { in: ["scheduled", "planned", "ongoing"] },
                    },
                    include: {
                         scheduleLogs: true,
                         student: { include: { user: true } },
                         teacher: { include: { user: true } },
                         groupStudents: {
                              include: { student: { include: { user: true } } },
                         },
                    },
               });

               if (expiredSessions.length === 0) return;

               console.log(`[Cron:FinalizeSessions] Found ${expiredSessions.length} expired session(s) to process.`);

               for (const session of expiredSessions) {
                    try {
                         const log = session.scheduleLogs?.[0];

                         const teacherJoined = Boolean(log?.joinTime_teacher);
                         const studentJoined = Boolean(log?.joinTime_student);
                         const bothAttended  = teacherJoined && studentJoined;

                         // Determine student IDs
                         const effectiveStudentIds = session.isGroup
                              ? (session.groupStudents || []).map((g) => g.studentId)
                              : session.studentId
                              ? [session.studentId]
                              : [];

                         const studentUserIds = session.student?.user_id
                              ? [session.student.user_id]
                              : (session.groupStudents || [])
                                   .map((g) => g.student?.user_id)
                                   .filter(Boolean);

                         const studentName = session.isGroup
                              ? `عدد ${session.groupStudents?.length || 0} طلاب`
                              : session.student?.user?.name || "Student";
                         const teacherName = session.teacher?.user?.name || "Teacher";

                         /* ─────────────────────────────────────────────────────
                          *  PATH A: Both attended → wait grace period, then complete
                          * ───────────────────────────────────────────────────── */
                         if (bothAttended) {
                              const graceDeadline = new Date(
                                   session.end_time.getTime() + FEEDBACK_GRACE_MINUTES * 60 * 1000,
                              );

                              // Still within grace window → skip for now
                              if (now < graceDeadline) continue;

                              // Grace period over → auto-complete
                              const sessionDurationHours =
                                   (session.end_time - session.start_time) / (60 * 1000 * 60);
                              let payoutAmount = sessionDurationHours * (session.teacher?.hour_price || 0);

                              // Apply late-teacher discount if applicable
                              if (log?.isTeacherLate && log?.joinTime_teacher) {
                                   const { getSettingsData } = await import("../Modules/Settings/settings.controller.js");
                                   const settings = await getSettingsData();
                                   const rules = settings.lateDiscountRules || [];
                                   const diffMinutes =
                                        (log.joinTime_teacher.getTime() - session.start_time.getTime()) / 60000;
                                   const sortedRules = [...rules].sort((a, b) => b.lateMinutes - a.lateMinutes);
                                   const matchedRule = sortedRules.find((r) => diffMinutes >= r.lateMinutes);
                                   if (matchedRule) {
                                        payoutAmount *= 1 - matchedRule.discountPercentage / 100;
                                   }
                              }

                              await db.transaction(async (tx) => {
                                   // Mark session completed
                                   await tx.updateOne({
                                        model: "schedule",
                                        where: { id: session.id },
                                        data: { status: "completed" },
                                   });

                                   // Pay teacher
                                   if (payoutAmount > 0) {
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
                                   }

                                   // Count attended session for each student
                                   for (const sId of effectiveStudentIds) {
                                        await tx.updateOne({
                                             model: "student",
                                             where: { id: sId },
                                             data: { sessions_attended: { increment: 1 } },
                                        });
                                   }

                                   // Mark log as completed
                                   if (log) {
                                        await tx.updateOne({
                                             model: "scheduleLog",
                                             where: { id: log.id },
                                             data: {
                                                  isTeacherCompleted: true,
                                                  isStudentAttended: true,
                                             },
                                        });
                                   }
                              });

                              // Notify teacher
                              if (session.teacher?.user_id) {
                                   await createNotification({
                                        userId: session.teacher.user_id,
                                        title: "تم إتمام الجلسة",
                                        message: `تم إتمام الجلسة "${session.title}" تلقائياً وإضافة المكافأة لمحفظتك.`,
                                        type: "session_completed",
                                   });
                              }

                              // Notify students
                              for (const uId of studentUserIds) {
                                   await createNotification({
                                        userId: uId,
                                        title: "تم إتمام الجلسة",
                                        message: `تم إتمام الجلسة "${session.title}" بنجاح.`,
                                        type: "session_completed",
                                   });
                              }

                              await createAdminNotification({
                                   title: "تم إتمام الجلسة تلقائياً",
                                   message: `تم إتمام الجلسة "${session.title}" بين الطالب: ${studentName} والمدرس: ${teacherName} تلقائياً بعد انتهاء نافذة الفيدباك.`,
                                   type: "session_completed",
                              });

                              console.log(`[Cron:FinalizeSessions] Session ${session.id} auto-completed. payout=${payoutAmount.toFixed(2)}`);
                              continue;
                         }

                         /* ─────────────────────────────────────────────────────
                          *  PATH B: At least one party absent → missed immediately
                          * ───────────────────────────────────────────────────── */
                         const shouldRefund = !teacherJoined; // teacher absent → refund student

                         await db.transaction(async (tx) => {
                              await tx.updateOne({
                                   model: "schedule",
                                   where: { id: session.id },
                                   data: { status: "missed" },
                              });

                              if (shouldRefund && effectiveStudentIds.length > 0) {
                                   for (const sId of effectiveStudentIds) {
                                        await tx.updateOne({
                                             model: "student",
                                             where: { id: sId },
                                             data: { sessions_remaining: { increment: 1 } },
                                        });
                                   }
                              }
                         });

                         // Notify students
                         for (const uId of studentUserIds) {
                              await createNotification({
                                   userId: uId,
                                   title: "جلسة فائتة",
                                   message: `تم اعتبار الجلسة "${session.title}" فائتة.`,
                                   type: "session_missed",
                              });
                         }

                         // Notify teacher if student was absent but teacher showed up
                         if (teacherJoined && !studentJoined && session.teacher?.user_id) {
                              await createNotification({
                                   userId: session.teacher.user_id,
                                   title: "جلسة فائتة",
                                   message: `الطالب لم يحضر الجلسة "${session.title}".`,
                                   type: "session_missed",
                              });
                         }

                         let reasonNote = "";
                         if (!teacherJoined && !studentJoined) {
                              reasonNote = " (لم يحضر أي طرف)";
                         } else if (!teacherJoined) {
                              reasonNote = " (المعلم لم يحضر — تم رد الجلسة للطالب)";
                         } else {
                              reasonNote = " (الطالب لم يحضر)";
                         }

                         await createAdminNotification({
                              title: "تم تفويت الجلسة",
                              message: `تم تفويت الجلسة "${session.title}" بين الطالب: ${studentName} والمدرس: ${teacherName}${reasonNote}.`,
                              type: "session_missed",
                         });

                         console.log(`[Cron:FinalizeSessions] Session ${session.id} marked as missed. teacherJoined=${teacherJoined}, studentJoined=${studentJoined}, refunded=${shouldRefund}`);
                    } catch (sessionError) {
                         console.error(`[Cron:FinalizeSessions] Error processing session ${session.id}:`, sessionError);
                    }
               }
          } catch (error) {
               console.error("[Cron:FinalizeSessions] Fatal error:", error);
          }
     });
};

export const startCronJobs = () => {
     deleteSoftDeletedMessages();
     markMissedSessions();
     console.log("Cron jobs initialized.");
};
