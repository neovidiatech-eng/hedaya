import { connection, notificationQueue } from "../Radis/Connection.js";
import { Worker } from "bullmq";
import * as db from "../../database/dbService.js";
import { sendEmail } from "../Mailer/SendEmail.js";
import { getMessage } from "../i18n.js";
import { createNotification } from "../../Modules/Notifications/notifications.controller.js";

const formatSessionDate = (date, timezone = "Africa/Cairo") => {
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Cairo",
    }).format(date);
  }
};

// Bug #1 Fix: jobId unique per schedule + student to avoid collision in group sessions
export const addNotificationJob = async ({
  scheduleId,
  studentId,
  teacherId,
  type,
  sendAt,
}) => {
  await notificationQueue.add(
    "send-notification",
    { scheduleId, studentId, teacherId, type },
    {
      jobId: `${scheduleId}_${studentId ?? "grp"}_${teacherId ?? "noteacher"}_${type}`,
      delay: Math.max(0, sendAt - new Date()),
    },
  );
};

export const removeNotificationJob = async (scheduleId) => {
  // Remove all jobs related to this schedule (covers group sessions with multiple students)
  const jobs = await notificationQueue.getJobs(["delayed", "waiting"]);
  for (const job of jobs) {
    if (job.data?.scheduleId === scheduleId) {
      await job.remove();
    }
  }
};

const worker = new Worker(
  "notifications",
  async (job) => {
    const { scheduleId, studentId, teacherId, type } = job.data;

    // Bug #2 Fix: query by scheduleId only (supports both individual and group sessions)
    const schedule = await db.findFirst({
      model: "schedule",
      where: {
        id: scheduleId,
        status: { not: "cancelled" },
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                timezone: true,
              },
            },
          },
        },
        groupStudents: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    timezone: true,
                  },
                },
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                timezone: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      console.warn(`Skipped ${type} notification for schedule ${scheduleId}: schedule not found or cancelled`);
      return;
    }

    // Determine the target student for this job
    let targetStudent = null;
    if (studentId) {
      if (schedule.isGroup) {
        const groupEntry = schedule.groupStudents?.find((g) => g.studentId === studentId);
        targetStudent = groupEntry?.student ?? null;
      } else {
        targetStudent = schedule.student ?? null;
      }
    }

    const teacherUser = schedule.teacher?.user;
    const teacherTimezone = teacherUser?.timezone || "Africa/Cairo";
    const sessionDateForTeacher = formatSessionDate(schedule.start_time, teacherTimezone);

    // Bug #3 Fix: Send in-app notification + email to teacher
    if (teacherId && teacherUser?.id) {
      await createNotification({
        userId: teacherUser.id,
        title: "تذكير بموعد الجلسة",
        message: `جلستك "${schedule.title}" ستبدأ قريباً (${sessionDateForTeacher}).`,
        type: "session_reminder",
      });

      if (teacherUser.email) {
        const subject = getMessage("SESSION_REMINDER_EMAIL_SUBJECT", "ar");
        const text = getMessage("SESSION_REMINDER_EMAIL_TEXT", "ar", {
          name: teacherUser.name || "أستاذنا الكريم",
          title: schedule.title,
          teacher: teacherUser.name || "أنت",
          time: sessionDateForTeacher,
          link: schedule.link,
        });

        await sendEmail({
          email: teacherUser.email,
          subject,
          text,
          username: teacherUser.name || "أستاذنا الكريم",
          lang: "ar",
          variant: "session_reminder",
          metadata: {
            sessionTitle: schedule.title,
            teacherName: teacherUser.name || "أستاذنا الكريم",
            sessionTime: sessionDateForTeacher,
          },
          actionUrl: schedule.link,
          actionText: "انضم إلى الجلسة",
        });
      }
    }

    // Send in-app notification + email to the target student
    if (!targetStudent?.user?.email) {
      console.warn(`Skipped student ${type} notification for schedule ${scheduleId}: student email not found`);
      return;
    }

    const studentUser = targetStudent.user;
    const studentTimezone = studentUser.timezone || "Africa/Cairo";
    const sessionDateForStudent = formatSessionDate(schedule.start_time, studentTimezone);

    await createNotification({
      userId: studentUser.id,
      title: "تذكير بموعد الجلسة",
      message: `جلستك "${schedule.title}" ستبدأ قريباً (${sessionDateForStudent}).`,
      type: "session_reminder",
    });

    const subject = getMessage("SESSION_REMINDER_EMAIL_SUBJECT", "ar");
    const text = getMessage("SESSION_REMINDER_EMAIL_TEXT", "ar", {
      name: studentUser.name || "عزيزنا المشترك",
      title: schedule.title,
      teacher: teacherUser?.name || "معلمك",
      time: sessionDateForStudent,
      link: schedule.link,
    });

    const result = await sendEmail({
      email: studentUser.email,
      subject,
      text,
      username: studentUser.name || "عزيزنا المشترك",
      lang: "ar",
      variant: "session_reminder",
      metadata: {
        sessionTitle: schedule.title,
        teacherName: teacherUser?.name || "معلمك",
        sessionTime: sessionDateForStudent,
      },
      actionUrl: schedule.link,
      actionText: "انضم إلى الجلسة",
    });

    if (!result.success) {
      throw new Error(
        `Failed to send ${type} notification for schedule ${scheduleId}: ${result.error}`,
      );
    }
  },
  { connection },
);
