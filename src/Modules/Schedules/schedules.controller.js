import {
  asyncHandler,
  successResponse,
  errorResponse,
} from "../../Utils/Response.js";
import {
  checkExist,
  getDatesBetweenUTC,
  combineDateAndTime,
  getEndTime,
  normalizeDate,
  formatSchedules,
} from "../../Utils/Helpers.js";
import { nanoid } from "nanoid";

import * as db from "../../database/dbService.js";
import { notificationType } from "../../Utils/Enums/sessions.js";
import {
  addNotificationJob,
  removeNotificationJob,
} from "../../Utils/Workers/notifications.js";
import {
  getNowUTC,
  isBeforeAllowedJoinTime,
  isInsideJoinWindow,
  toLocal,
} from "../../Utils/Date/time.js";
import dayjs from "dayjs";
import { getSettingsData } from "../Settings/settings.controller.js";
import { createAdminNotification, createNotification } from "../Notifications/notifications.controller.js";

/* ------------------------------------------------------------------ */
/*            Admin creates multiple sessions in one request            */
/* ------------------------------------------------------------------ */
export const getAllSchedules = asyncHandler(async (req, res, next) => {
  const { search, start_date, end_date, page = 1, limit = 10 } = req.query;

  const where = {};
  if (search) {
    where.OR = [
      {
        student: {
          user: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      },
      {
        groupStudents: {
          some: {
            student: {
              user: {
                name: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      },
      {
        teacher: {
          user: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  // 📅 فلترة بالتاريخ
  if (start_date && end_date) {
    where.start_time = {
      gte: normalizeDate(start_date, req.timezone),
      lte: normalizeDate(end_date, req.timezone),
    };
  }

  const { items: schedule, pagination } =
    await db.findManyWithPaginationAndCount({
      model: "schedule",
      where,
      page,
      limit,
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                code_country: true,
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
                    name: true,
                    email: true,
                    phone: true,
                    code_country: true,
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
                name: true,
                email: true,
                phone: true,
                code_country: true,
              },
            },
          },
        },
        subject: true,
      },
    });

  const formattedSchedules = formatSchedules(schedule, req.timezone);

  return successResponse({
    res,
    req,
    data: { schedule: formattedSchedules, pagination },
    status: 200,
    message: "FETCH_SUCCESS",
  });
});
export const createSchedule = asyncHandler(async (req, res, next) => {
  const {
    studentId,
    studentIds = [],
    isGroup = false,
    maxStudents = 1,
    teacherId,
    subject_id,
    title,
    description,
    link,
    notification_Time = "10",
    notes,
    date,
    start_time,
  } = req.body;

  const effectiveStudentIds = Array.from(
    new Set([studentId, ...(Array.isArray(studentIds) ? studentIds : [])].filter(Boolean))
  );

  if (effectiveStudentIds.length === 0) {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "STUDENT_ID_REQUIRED",
    });
  }

  const computedIsGroup = effectiveStudentIds.length > 1 ? true : Boolean(isGroup);

  let normalizedMaxStudents =
    maxStudents === "0" || maxStudents === 0 || maxStudents === "unlimited"
      ? "unlimited"
      : String(maxStudents || 1);

  if (computedIsGroup && normalizedMaxStudents !== "unlimited") {
    const max = parseInt(normalizedMaxStudents, 10);
    if (!isNaN(max) && effectiveStudentIds.length > max) {
      return errorResponse({
        req,
        next,
        status: 400,
        message: "EXCEEDED_MAX_STUDENTS",
      });
    }
  }

  /* check if students, teacher, and subject exist */
  const [students, teacher, subject] = await Promise.all([
    db.findMany({
      model: "student",
      where: { id: { in: effectiveStudentIds } },
      include: { plan: true, user: true },
    }),
    checkExist({ model: "teacher", where: { id: teacherId }, next }),
    checkExist({ model: "subjects", where: { id: subject_id }, next }),
  ]);

  if (students.length !== effectiveStudentIds.length) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "STUDENT_NOT_FOUND",
    });
  }

  // Session check for all students
  const requiredSessions = 1;
  for (const st of students) {
    if (st.sessions_remaining < requiredSessions) {
      return errorResponse({
        req,
        next,
        status: 400,
        message: "INSUFFICIENT_SESSIONS",
        messageParams: { remaining: st.sessions_remaining, student: st.user?.name },
      });
    }
  }

  const primaryStudent = students[0];
  const startTime = normalizeDate(start_time, req.timezone);
  const endTime = getEndTime({
    startTime,
    duration: primaryStudent?.plan?.sessionTime || 60,
    tz: req.timezone,
  });

  /* check if any effective student or teacher are available at the same time */
  const [studentSchedule, teacherSchedule] = await Promise.all([
    db.findFirst({
      model: "schedule",
      where: {
        status: { not: "cancelled" },
        start_time: { lt: endTime },
        end_time: { gt: startTime },
        OR: [
          { studentId: { in: effectiveStudentIds } },
          { groupStudents: { some: { studentId: { in: effectiveStudentIds } } } },
        ],
      },
    }),

    db.findFirst({
      model: "schedule",
      where: {
        teacherId,
        status: { not: "cancelled" },
        start_time: { lt: endTime },
        end_time: { gt: startTime },
      },
    }),
  ]);

  if (studentSchedule) {
    return errorResponse({
      req,
      next,
      status: 409,
      message: "STUDENT_CONFLICT",
      messageParams: { title: studentSchedule.title },
    });
  }

  if (teacherSchedule) {
    return errorResponse({
      req,
      next,
      status: 409,
      message: "TEACHER_CONFLICT",
      messageParams: { title: teacherSchedule.title },
    });
  }

  // Atomically create the schedule and deduct the session for all students
  let newSchedule;
  await db.transaction(async (tx) => {
    newSchedule = await tx.create({
      model: "schedule",
      data: {
        studentId: computedIsGroup ? null : (studentId || effectiveStudentIds[0]),
        teacherId,
        title,
        description,
        link: teacher?.meeting_link ? teacher.meeting_link : link,
        notes,
        subjectId: subject_id,
        start_time: startTime,
        end_time: endTime,
        isGroup: computedIsGroup,
        maxStudents: computedIsGroup ? normalizedMaxStudents : "1",
      },
    });

    for (const sId of effectiveStudentIds) {
      if (computedIsGroup) {
        await tx.create({
          model: "GroupScheduleStudent",
          data: {
            scheduleId: newSchedule.id,
            studentId: sId,
          },
        });
      }

      await tx.updateOne({
        model: "student",
        where: { id: sId },
        data: { sessions_remaining: { decrement: requiredSessions } },
      });
    }

    await tx.create({
      model: "scheduleLog",
      data: {
        scheduleId: newSchedule.id,
      },
    });
  });

  let reminderTime;
  let notificationJobType;
  if (notification_Time === notificationType[1]) {
    reminderTime = new Date(startTime.getTime() - 10 * 60 * 1000);
    notificationJobType = "before 10 minutes";
  } else if (notification_Time === notificationType[2]) {
    reminderTime = new Date(startTime.getTime() - 30 * 60 * 1000);
    notificationJobType = "before 30 minutes";
  } else if (notification_Time === notificationType[3]) {
    reminderTime = new Date(startTime.getTime() - 60 * 60 * 1000);
    notificationJobType = "before 60 minutes";
  } else {
    reminderTime = new Date(startTime.getTime() - 5 * 60 * 1000);
    notificationJobType = "before 5 minutes";
  }

  const now = new Date();
  if (reminderTime > now) {
    for (const sId of effectiveStudentIds) {
      addNotificationJob({
        scheduleId: newSchedule.id,
        studentId: sId,
        teacherId,
        type: notificationJobType,
        sendAt: reminderTime,
      });
    }
  }

  const teacherInfo = await db.findOne({
    model: "teacher",
    where: { id: teacherId },
    include: { user: true },
  });

  // Bug #4 Fix: Notify teacher and all students immediately upon session creation
  if (teacherInfo?.user_id) {
    await createNotification({
      userId: teacherInfo.user_id,
      title: "تم جدولة جلسة جديدة",
      message: `تم جدولة جلسة "${title}" في ${new Date(startTime).toLocaleString("ar-EG", { timeZone: req.timezone })}.`,
      type: "session_created",
    });
  }

  for (const st of students) {
    if (st.user?.id) {
      await createNotification({
        userId: st.user.id,
        title: "تم جدولة جلسة جديدة",
        message: `تم جدولة جلستك "${title}" مع المدرس: ${teacherInfo?.user?.name || "المدرس"} في ${new Date(startTime).toLocaleString("ar-EG", { timeZone: req.timezone })}.`,
        type: "session_created",
      });
    }
  }

  await createAdminNotification({
    title: "تم جدولة الجلسة",
    message: isGroup
      ? `تم جدولة جلسة جماعية جديدة "${title}" لعدد ${effectiveStudentIds.length} طلاب مع المدرس: ${teacherInfo?.user?.name || "Teacher"}.`
      : `تم جدولة جلسة جديدة "${title}" للطالب: ${primaryStudent?.user?.name || "Student"} مع المدرس: ${teacherInfo?.user?.name || "Teacher"}.`,
    type: "session_created",
  });

  const fullSchedule = await db.findOne({
    model: "schedule",
    where: { id: newSchedule.id },
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
      subject: true,
      groupStudents: { include: { student: { include: { user: true } } } },
    },
  });

  return successResponse({
    res,
    req,
    data: {
      schedule: formatSchedules(fullSchedule, req.timezone),
    },
    status: 201,
    message: "CREATE_SUCCESS",
  });
});

/* ------------------------------------------------------------------ */
/*            Admin creates recurring sessions in one request           */
/* ------------------------------------------------------------------ */
export const createRecurringSchedule = asyncHandler(async (req, res, next) => {
  const {
    studentId,
    studentIds = [],
    isGroup = false,
    maxStudents = 1,
    teacherId,
    subject_id,
    title,
    description,
    link,
    notes,
    startTime: timeStart, // "HH:mm"
    days, // ["Saturday", ...]
    startDate, // "2026-03-26"
    endDate, // "2026-04-26"
    count, // 10
    notification_Time,
  } = req.body;
  const skipedSchedules = [];
  const perSessionUnits = 1;

  const effectiveStudentIds = Array.from(
    new Set([studentId, ...(Array.isArray(studentIds) ? studentIds : [])].filter(Boolean))
  );

  if (effectiveStudentIds.length === 0) {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "STUDENT_ID_REQUIRED",
    });
  }

  const computedIsGroup = effectiveStudentIds.length > 1 ? true : Boolean(isGroup);

  let normalizedMaxStudents =
    maxStudents === "0" || maxStudents === 0 || maxStudents === "unlimited"
      ? "unlimited"
      : String(maxStudents || 1);

  if (computedIsGroup && normalizedMaxStudents !== "unlimited") {
    const max = parseInt(normalizedMaxStudents, 10);
    if (!isNaN(max) && effectiveStudentIds.length > max) {
      return errorResponse({
        req,
        next,
        status: 400,
        message: "EXCEEDED_MAX_STUDENTS",
      });
    }
  }

  /* check exist students, teacher, subject */
  const [students, teacher, subject] = await Promise.all([
    db.findMany({
      model: "student",
      where: { id: { in: effectiveStudentIds } },
      include: { plan: true, user: true },
    }),
    checkExist({ model: "teacher", where: { id: teacherId }, next }),
    checkExist({ model: "subjects", where: { id: subject_id }, next }),
  ]);

  if (students.length !== effectiveStudentIds.length) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "STUDENT_NOT_FOUND",
    });
  }

  const primaryStudent = students[0];
  const minSessionsRemaining = Math.min(...students.map((s) => s.sessions_remaining));

  // If count is not provided but student has sessions, we could use minSessionsRemaining as a default count if endDate is missing
  const effectiveCount = count || (endDate ? null : minSessionsRemaining);

  let dates = getDatesBetweenUTC(startDate, endDate, days, effectiveCount);

  // Session check for recurring: Cap the dates to the minimum remaining sessions among all students
  if (dates.length > minSessionsRemaining) {
    dates = dates.slice(
      0,
      Math.floor(minSessionsRemaining / perSessionUnits),
    );
  }

  if (dates.length === 0) {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "INSUFFICIENT_SESSIONS_OR_INVALID_RANGE",
      messageParams: {
        remaining: minSessionsRemaining,
      },
    });
  }

  const createdSchedules = [];
  const schedulesToCreate = [];
  const notificationJobs = [];
  const parentRecurringId = `rec_${nanoid(10)}`;

  const allDatesStart = dates.map((d) => {
    return combineDateAndTime(d, timeStart, req.timezone);
  });
  // Determine the overall window for the batch conflict query
  const windowStart = allDatesStart[0];
  const lastDate = allDatesStart[allDatesStart.length - 1];
  const windowEnd = getEndTime({
    startTime: lastDate,
    duration: primaryStudent.plan?.sessionTime,
    tz: req.timezone,
  });

  // Pre-fetch ALL conflicts in 2 queries instead of 2-per-date (N+1 fix)
  const [allTeacherConflicts, allStudentConflicts] = await Promise.all([
    db.findMany({
      model: "schedule",
      where: {
        teacherId,
        status: { not: "cancelled" },
        start_time: { lt: windowEnd },
        end_time: { gt: windowStart },
      },
      select: { id: true, start_time: true, end_time: true, title: true },
    }),
    db.findMany({
      model: "schedule",
      where: {
        status: { not: "cancelled" },
        start_time: { lt: windowEnd },
        end_time: { gt: windowStart },
        OR: [
          { studentId: { in: effectiveStudentIds } },
          { groupStudents: { some: { studentId: { in: effectiveStudentIds } } } },
        ],
      },
      select: { id: true, start_time: true, end_time: true, title: true },
    }),
  ]);

  for (const date of dates) {
    const start_time = combineDateAndTime(date, timeStart, req.timezone);

    const end_time = getEndTime({
      startTime: start_time,
      duration: primaryStudent.plan?.sessionTime,
      tz: req.timezone,
    });

    // In-memory overlap check (avoids DB query per iteration)
    const teacher_conflict = allTeacherConflicts.find(
      (s) => s.start_time < end_time && s.end_time > start_time,
    );
    const student_conflict = allStudentConflicts.find(
      (s) => s.start_time < end_time && s.end_time > start_time,
    );

    if (student_conflict) {
      skipedSchedules.push({
        date: date.toISOString().split("T")[0],
        title: student_conflict.title,
        conflict: "STUDENT_NOT_AVAILABLE",
      });
      continue;
    }
    if (teacher_conflict) {
      skipedSchedules.push({
        date: date.toISOString().split("T")[0],
        title: teacher_conflict.title,
        conflict: "TEACHER_NOT_AVAILABLE",
      });
      continue;
    }

    schedulesToCreate.push({
      studentId: computedIsGroup ? null : (studentId || effectiveStudentIds[0]),
      teacherId,
      title,
      description,
      link: teacher?.meeting_link ? teacher.meeting_link : link,
      notes,
      start_time,
      end_time,
      subjectId: subject_id,
      is_recurring: true,
      isGroup: computedIsGroup,
      maxStudents: computedIsGroup ? normalizedMaxStudents : "1",
      day_of_week: dayjs.tz(date, req.timezone).format("dddd"),
      parent_recurring_id: parentRecurringId,
    });

    notificationJobs.push({
      start_time,
      notification_Time,
      index: schedulesToCreate.length - 1,
    });
  }

  // Atomically create all valid schedules + deduct sessions in one transaction
  if (schedulesToCreate.length > 0) {
    await db.transaction(async (tx) => {
      for (const scheduleData of schedulesToCreate) {
        const schedule = await tx.create({
          model: "schedule",
          data: scheduleData,
        });

        for (const sId of effectiveStudentIds) {
          if (computedIsGroup) {
            await tx.create({
              model: "GroupScheduleStudent",
              data: {
                scheduleId: schedule.id,
                studentId: sId,
              },
            });
          }
        }

        await tx.create({
          model: "scheduleLog",
          data: {
            scheduleId: schedule.id,
          },
        });

        createdSchedules.push({
          id: schedule.id,
          date: scheduleData.start_time.toISOString().split("T")[0],
          start_time: scheduleData.start_time.toISOString(),
        });
      }

      for (const sId of effectiveStudentIds) {
        await tx.updateOne({
          model: "student",
          where: { id: sId },
          data: {
            sessions_remaining: {
              decrement: createdSchedules.length * perSessionUnits,
            },
          },
        });
      }
    });

    // Queue notification jobs after successful transaction
    const now = new Date();
    for (const {
      start_time: st,
      notification_Time: nt,
      index,
    } of notificationJobs) {
      let reminderTime;
      let notificationJobType;
      if (nt === notificationType[1]) {
        reminderTime = new Date(st.getTime() - 10 * 60 * 1000);
        notificationJobType = "before 10 minutes";
      } else if (nt === notificationType[2]) {
        reminderTime = new Date(st.getTime() - 30 * 60 * 1000);
        notificationJobType = "before 30 minutes";
      } else {
        reminderTime = new Date(st.getTime() - 60 * 60 * 1000);
        notificationJobType = "before 60 minutes";
      }
      if (reminderTime > now) {
        for (const sId of effectiveStudentIds) {
          addNotificationJob({
            scheduleId: createdSchedules[index]?.id,
            studentId: sId,
            teacherId,
            type: notificationJobType,
            sendAt: reminderTime,
          });
        }
      }
    }
  }

  if (createdSchedules.length > 0) {
    const teacherInfo = await db.findOne({ model: "teacher", where: { id: teacherId }, include: { user: true } });

    // Bug #4 Fix: Notify teacher and all students immediately upon recurring session creation
    if (teacherInfo?.user_id) {
      await createNotification({
        userId: teacherInfo.user_id,
        title: "تم جدولة جلسات متكررة",
        message: `تم جدولة ${createdSchedules.length} جلسات متكررة "${title}" في جدولك.`,
        type: "session_created",
      });
    }

    for (const st of students) {
      if (st.user?.id) {
        await createNotification({
          userId: st.user.id,
          title: "تم جدولة جلسات متكررة",
          message: `تم جدولة ${createdSchedules.length} جلسات متكررة "${title}" مع المدرس: ${teacherInfo?.user?.name || "المدرس"}.`,
          type: "session_created",
        });
      }
    }

    await createAdminNotification({
      title: "تم جدولة الجلسات المتكررة",
      message: isGroup
        ? `تم جدولة ${createdSchedules.length} جلسات متكررة جماعية لعدد ${effectiveStudentIds.length} طلاب مع المدرس: ${teacherInfo?.user?.name || "Teacher"}.`
        : `تم جدولة ${createdSchedules.length} جلسات متكررة للطالب: ${primaryStudent?.user?.name || "Student"} مع المدرس: ${teacherInfo?.user?.name || "Teacher"}.`,
      type: "session_created",
    });
  }

  return successResponse({
    res,
    req,
    status: 201,
    message: createdSchedules.length
      ? "RECURRING_CREATE_SUCCESS"
      : "RECURRING_CREATE_WITH_CONFLICTS",
    messageParams: { length: skipedSchedules.length },
    data: { conflicts: skipedSchedules },
  });
});

/* ------------------------------------------------------------------ */
/*             Get all schedules (teacher dashboard / admin)            */
/* ------------------------------------------------------------------ */
export const getUserSchedules = asyncHandler(async (req, res, next) => {
  const { user } = req;
  const { status, search } = req.query;

  const where = {};
  if (status) where.status = status;

  // Handle filtering based on user role
  if (user.role?.name?.toLowerCase() === "teacher") {
    const teacher = user.teacher;
    if (!teacher) {
      return errorResponse({
        req,
        next,
        status: 404,
        message: "TEACHER_NOT_FOUND",
      });
    }
    where.teacherId = teacher.id;
  } else if (user.role?.name?.toLowerCase() === "student") {
    const student = user.student;
    if (!student) {
      return errorResponse({
        req,
        next,
        status: 404,
        message: "STUDENT_NOT_FOUND",
      });
    }
    where.OR = [
      { studentId: student.id },
      { groupStudents: { some: { studentId: student.id } } },
    ];
  }

  if (search) {
    if (where.teacherId) {
      // If teacher is viewing, search by student name
      where.OR = [
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { groupStudents: { some: { student: { user: { name: { contains: search, mode: "insensitive" } } } } } }
      ];
    } else if (user.role?.name?.toLowerCase() === "student") {
      // If student is viewing, search by teacher name
      where.teacher = {
        user: {
          name: { contains: search, mode: "insensitive" },
        },
      };
    } else {
      // If admin, search by both
      where.OR = [
        {
          student: {
            user: { name: { contains: search, mode: "insensitive" } },
          },
        },
        {
          groupStudents: {
            some: { student: { user: { name: { contains: search, mode: "insensitive" } } } }
          }
        },
        {
          teacher: {
            user: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }
  }

  const schedules = await db.findMany({
    model: "schedule",
    where,
    include: {
      scheduleLogs: true,
      student: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              code_country: true,
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
                  name: true,
                  email: true,
                  phone: true,
                  code_country: true,
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
              name: true,
              email: true,
              phone: true,
              code_country: true,
            },
          },
        },
      },
      subject: true,
    },
    orderBy: { start_time: "asc" },
  });

  const formattedSchedules = formatSchedules(schedules, req.timezone).map(
  (schedule) => {
    if (user.role?.name?.toLowerCase() !== "student") {
      return schedule;
    }

    const log = schedule.scheduleLogs?.[0];
    const now = new Date();

    const isFinished = new Date(schedule.end_time) <= now;
    const studentDidNotAttend = !log?.joinTime_student;

    if (
      isFinished &&
      studentDidNotAttend &&
      ["planned", "scheduled", "ongoing"].includes(schedule.status)
    ) {
      return {
        ...schedule,
        status: "missed",
      };
    }

    return schedule;
  }
);

  return successResponse({
    res,
    req,
    status: 200,
    message: "FETCH_SUCCESS",
    data: formattedSchedules,
  });
});

/* ------------------------------------------------------------------ */
/*                  Delete a single session & its job                   */
/* ------------------------------------------------------------------ */
export const deleteSchedule = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const schedule = await db.findOne({
    model: "schedule",
    where: { id },
    include: {
      groupStudents: { include: { student: { include: { user: true } } } },
      student: { include: { user: true } },
      teacher: { include: { user: true } },
    },
  });

  if (!schedule) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "SESSION_NOT_FOUND",
    });
  }

  // Removal job from BullMQ
  await removeNotificationJob(id);

  const effectiveStudentIds = schedule.isGroup
    ? (schedule.groupStudents || []).map((g) => g.studentId)
    : (schedule.studentId ? [schedule.studentId] : []);

  // 🛡️ Use transaction to ensure refund and deletion happen together
  await db.transaction(async (tx) => {
    // Refund sessions if it wasn't already cancelled
    if (schedule.status !== "cancelled") {
      const refundSessions = 1;
      for (const sId of effectiveStudentIds) {
        await tx.updateOne({
          model: "student",
          where: { id: sId },
          data: { sessions_remaining: { increment: refundSessions } },
        });
      }
    }

    // Delete from DB
    await tx.deleteOne({
      model: "schedule",
      where: { id: id },
    });
  });

  const studentName = schedule.isGroup
    ? `عدد ${effectiveStudentIds.length} طلاب`
    : (schedule.student?.user?.name || "Student");

  await createAdminNotification({
    title: "تم إلغاء الجلسة",
    message: `تم إلغاء الجلسة "${schedule.title}" للطالب: ${studentName} مع المدرس: ${schedule.teacher?.user?.name || "Teacher"}.`,
    type: "session_cancelled",
  });

  return successResponse({
    res,
    req,
    status: 200,
    message: "DELETE_SUCCESS",
  });
});

/* ------------------------------------------------------------------ */
/*              Delete a recurring group & all its jobs                 */
/* ------------------------------------------------------------------ */
export const deleteRecurringGroup = asyncHandler(async (req, res, next) => {
  const { parent_recurring_id } = req.params;

  const schedules = await db.findMany({
    model: "schedule",
    where: { parent_recurring_id },
    include: {
      groupStudents: true,
      teacher: { include: { user: true } },
      student: { include: { user: true } },
    },
  });

  const sessionsCount = schedules.length;

  if (!sessionsCount) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "RECURRING_GROUP_NOT_FOUND",
    });
  }

  // Remove all jobs
  await Promise.all(schedules.map((s) => removeNotificationJob(s.id)));

  // Calculate refund per student for non-cancelled sessions
  const studentRefundCounts = {};
  for (const s of schedules) {
    if (s.status !== "cancelled") {
      const studentIds = s.isGroup
        ? (s.groupStudents || []).map((g) => g.studentId)
        : (s.studentId ? [s.studentId] : []);
      for (const sId of studentIds) {
        studentRefundCounts[sId] = (studentRefundCounts[sId] || 0) + 1;
      }
    }
  }

  // 🛡️ Use transaction to ensure refund and mass deletion happen together
  await db.transaction(async (tx) => {
    for (const [sId, count] of Object.entries(studentRefundCounts)) {
      await tx.updateOne({
        model: "student",
        where: { id: sId },
        data: { sessions_remaining: { increment: count } },
      });
    }

    // Delete all sessions
    await tx.deleteMany({
      model: "schedule",
      where: { parent_recurring_id },
    });
  });

  const firstSchedule = schedules[0];

  if (firstSchedule) {
    await createAdminNotification({
      title: "تم إلغاء الجلسات المتكررة",
      message: `تم إلغاء جميع الجلسات المتكررة تحت المجموعة "${parent_recurring_id}" مع المدرس: ${firstSchedule.teacher?.user?.name || "Teacher"}.`,
      type: "session_cancelled",
    });
  }

  return successResponse({
    res,
    req,
    status: 200,
    message: "RECURRING_DELETE_SUCCESS",
    messageParams: { length: schedules.length },
  });
});

/* ------------------------------------------------------------------ */
/*                  Update a single session & its job                   */
/* ------------------------------------------------------------------ */
export const updateSchedule = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { start_time, notification_Time, ...otherData } = req.body;

  const schedule = await db.findOne({
    model: "schedule",
    where: { id },
    include: {
      student: { include: { plan: true, user: true } },
      teacher: { include: { user: true } },
      groupStudents: { include: { student: { include: { plan: true, user: true } } } },
    },
  });

  if (!schedule) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "SESSION_NOT_FOUND",
    });
  }

  const effectiveStudentIds = schedule.isGroup
    ? (schedule.groupStudents || []).map((g) => g.studentId)
    : (schedule.studentId ? [schedule.studentId] : []);

  const primaryStudent = schedule.student || schedule.groupStudents?.[0]?.student;

  let startTime = schedule.start_time;
  let endTime = schedule.end_time;

  let scheduleUpdated = false;

  const updateData = { ...otherData };

  // If time or type changes, recalculate end time and check conflicts
  if (start_time) {
    startTime = start_time
      ? normalizeDate(start_time, req.timezone)
      : startTime;
    endTime = getEndTime({
      startTime,
      duration: primaryStudent?.plan?.sessionTime || 60,
      tz: req.timezone,
    });

    updateData.start_time = startTime;
    updateData.end_time = endTime;
    scheduleUpdated = true;

    // Conflict check
    const teacher_conflict = await db.findFirst({
      model: "schedule",
      where: {
        teacherId: schedule.teacherId,
        id: { not: id },
        status: { not: "cancelled" },
        start_time: { lt: endTime },
        end_time: { gt: startTime },
      },
    });

    const student_conflict = effectiveStudentIds.length > 0
      ? await db.findFirst({
          model: "schedule",
          where: {
            id: { not: id },
            status: { not: "cancelled" },
            start_time: { lt: endTime },
            end_time: { gt: startTime },
            OR: [
              { studentId: { in: effectiveStudentIds } },
              { groupStudents: { some: { studentId: { in: effectiveStudentIds } } } },
            ],
          },
        })
      : null;

    if (teacher_conflict || student_conflict) {
      return errorResponse({
        req,
        next,
        status: 409,
        message: "SESSION_CONFLICT",
      });
    }
  }

  // Handle session adjustments for status change
  if (otherData.status && otherData.status !== schedule.status) {
    const sessionUnits = 1;
    if (otherData.status === "cancelled") {
      // Refund all students
      for (const sId of effectiveStudentIds) {
        await db.updateOne({
          model: "student",
          where: { id: sId },
          data: { sessions_remaining: { increment: sessionUnits } },
        });
      }
    } else if (schedule.status === "cancelled") {
      // Restoring: Check sessions for all students
      for (const sId of effectiveStudentIds) {
        const st = await db.findOne({ model: "student", where: { id: sId } });
        if (!st || st.sessions_remaining < sessionUnits) {
          return errorResponse({
            req,
            next,
            status: 400,
            message: "INSUFFICIENT_SESSIONS_RESTORE",
          });
        }
      }
      for (const sId of effectiveStudentIds) {
        await db.updateOne({
          model: "student",
          where: { id: sId },
          data: { sessions_remaining: { decrement: sessionUnits } },
        });
      }
    }
  }

  const updatedSchedule = await db.updateOne({
    model: "schedule",
    where: { id },
    data: updateData,
  });

  // Handle notification job update
  if (scheduleUpdated || notification_Time || otherData.status) {
    await removeNotificationJob(id);

    // Only add a new job if the session is still "planned" or "scheduled"
    const currentStatus = otherData.status || updatedSchedule.status;
    if (currentStatus === "planned" || currentStatus === "scheduled") {
      const effectiveNotificationTime = notification_Time || "60";

      let reminderTime;
      let notificationJobType;
      if (effectiveNotificationTime === notificationType[1]) {
        reminderTime = new Date(startTime.getTime() - 10 * 60 * 1000);
        notificationJobType = "before 10 minutes";
      } else if (effectiveNotificationTime === notificationType[2]) {
        reminderTime = new Date(startTime.getTime() - 30 * 60 * 1000);
        notificationJobType = "before 30 minutes";
      } else {
        reminderTime = new Date(startTime.getTime() - 60 * 60 * 1000);
        notificationJobType = "before 60 minutes";
      }

      const now = new Date();
      if (reminderTime > now) {
        for (const sId of effectiveStudentIds) {
          addNotificationJob({
            scheduleId: id,
            studentId: sId,
            type: notificationJobType,
            sendAt: reminderTime,
          });
        }
      }
    }
  }

  const studentName = schedule.isGroup
    ? `عدد ${effectiveStudentIds.length} طلاب`
    : (primaryStudent?.user?.name || "Student");

  await createAdminNotification({
    title: "تم تعديل الجلسة",
    message: `تم تعديل الجلسة "${updatedSchedule.title}" للطالب: ${studentName} مع المدرس: ${schedule.teacher?.user?.name || "Teacher"}.`,
    type: "session_updated",
  });

  return successResponse({
    res,
    req,
    status: 200,
    message: "UPDATE_SUCCESS",
    data: formatSchedules(updatedSchedule, req.timezone),
  });
});

/* ------------------------------------------------------------------ */
/*                      Session Lifecycle Logic                        */
/* ------------------------------------------------------------------ */

export const joinSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;
  const role = user.role?.name?.toLowerCase();

  const session = await db.findOne({ model: "schedule", where: { id } });
  if (!session) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "SESSION_NOT_FOUND",
    });
  }

  if (session.status === "cancelled") {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "SESSION_CANCELLED",
    });
  }

  // 1. Check if it's too early (UTC comparison)
  if (isBeforeAllowedJoinTime(session.start_time, 5)) {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "TOO_EARLY_TO_JOIN",
      messageParams: {
        now: toLocal(getNowUTC(), req.timezone),
        start: toLocal(session.start_time, req.timezone),
      },
    });
  }

  // 2. Check if it's already finished (UTC comparison)
  const now = getNowUTC();
  const endTime = dayjs.utc(session.end_time);
  if (now.isAfter(endTime) || now.isSame(endTime)) {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "SESSION_ALREADY_FINISHED",
    });
  }

  const nowUTC = getNowUTC().toDate();

  // Get or Create Log
  let log = await db.findFirst({
    model: "scheduleLog",
    where: { scheduleId: id },
  });
  if (!log) {
    log = await db.create({
      model: "scheduleLog",
      data: { scheduleId: id },
    });
  }

  const updateData = {};
  if (role === "student") {
    updateData.joinTime_student = nowUTC;
  } else if (role === "teacher") {
    updateData.joinTime_teacher = nowUTC;
    const settings = await getSettingsData();
    const rules = settings.lateDiscountRules || [];
    const diffMinutes =
      (nowUTC.getTime() - session.start_time.getTime()) / (60 * 1000);
    const isLate = rules.some((r) => diffMinutes >= r.lateMinutes);
    if (isLate) {
      updateData.isTeacherLate = true;
      // Notify Admin
      await createNotification({
        userId: "admin",
        title: req.t("NOTIFICATION_TEACHER_LATE_TITLE"),
        message: req.t("NOTIFICATION_TEACHER_LATE_MSG", { id }),
        type: "teacher_late",
      });
    }
  }

  await db.updateOne({
    model: "scheduleLog",
    where: { id: log.id },
    data: updateData,
  });

  if (session.status === "scheduled" || session.status === "planned") {
    await db.updateOne({
      model: "schedule",
      where: { id },
      data: { status: "ongoing" },
    });
  }

  // Notify other party
  if (role === "student") {
    const teacherUser = await db.findOne({
      model: "teacher",
      where: { id: session.teacherId },
      include: { user: true },
    });

    if (teacherUser?.user?.id) {
      await createNotification({
        userId: teacherUser.user.id,
        title: req.t("NOTIFICATION_SESSION_JOINED_TITLE"),
        message: req.t("NOTIFICATION_SESSION_JOINED_MSG", {
          role: req.t("STUDENT"),
        }),
        type: "session_joined",
      });
    }
  } else if (role === "teacher") {
    const groupStudents = await db.findMany({
      model: "GroupScheduleStudent",
      where: { scheduleId: id },
      include: { student: { include: { user: true } } },
    });

    const studentUserIds = session.studentId
      ? [(await db.findOne({ model: "student", where: { id: session.studentId }, include: { user: true } }))?.user?.id].filter(Boolean)
      : groupStudents.map((g) => g.student?.user?.id).filter(Boolean);

    for (const uId of studentUserIds) {
      await createNotification({
        userId: uId,
        title: req.t("NOTIFICATION_SESSION_JOINED_TITLE"),
        message: req.t("NOTIFICATION_SESSION_JOINED_MSG", {
          role: req.t("TEACHER"),
        }),
        type: "session_joined",
      });
    }
  }

  return successResponse({ res, req, status: 200, message: "JOINED_SUCCESS" });
});

export const leaveSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;
  const role = user.role?.name?.toLowerCase();

  console.log(`[leaveSession] Request received - scheduleId: ${id}, userId: ${user?.id}, role: ${role}`);

  const log = await db.findFirst({
    model: "scheduleLog",
    where: { scheduleId: id },
    include: { schedule: true },
  });

  if (!log) {
    console.log(`[leaveSession] Log not found for scheduleId: ${id}`);
    return errorResponse({ req, next, status: 404, message: "LOG_NOT_FOUND" });
  }

  const session = log.schedule;
  const nowUTC = getNowUTC().toDate();
  const updateData = {};

  const SESSION_DURATION_MS = session.end_time - session.start_time;
  const MIN_ATTENDANCE_RATIO = 0.85;
  const MIN_ATTENDANCE_MS = SESSION_DURATION_MS * MIN_ATTENDANCE_RATIO;

  console.log(`[leaveSession] Session ${id} specs - durationMs: ${SESSION_DURATION_MS}, minAttendanceMs: ${MIN_ATTENDANCE_MS}, nowUTC: ${nowUTC.toISOString()}`);

  if (role === "student") {
    if (!log.joinTime_student) {
      console.log(`[leaveSession] Student ${user?.id} attempted to leave schedule ${id} but never joined.`);
      return errorResponse({ req, next, status: 400, message: "NEVER_JOINED" });
    }
    updateData.leaveTime_student = nowUTC;
    const duration = (nowUTC - log.joinTime_student) / 60000;
    updateData.duration_student = duration;
    console.log(`[leaveSession] Student left schedule ${id} - joinTime: ${log.joinTime_student}, leaveTime: ${nowUTC}, durationMinutes: ${duration.toFixed(2)}`);
  } else if (role === "teacher") {
    if (!log.joinTime_teacher) {
      console.log(`[leaveSession] Teacher ${user?.id} attempted to leave schedule ${id} but never joined.`);
      return errorResponse({ req, next, status: 400, message: "NEVER_JOINED" });
    }
    updateData.leaveTime_teacher = nowUTC;
    const duration = (nowUTC - log.joinTime_teacher) / 60000;
    updateData.duration_teacher = duration;
    console.log(`[leaveSession] Teacher left schedule ${id} - joinTime: ${log.joinTime_teacher}, leaveTime: ${nowUTC}, durationMinutes: ${duration.toFixed(2)}`);
  }

  await db.updateOne({
    model: "scheduleLog",
    where: { id: log.id },
    data: updateData,
  });

  // If session end time passed, finalize
  if (nowUTC >= session.end_time) {
    console.log(`[leaveSession] End time passed for schedule ${id}. Calling finalizeSession.`);
    await finalizeSession(id, req.t);
  } else {
    const updatedLog = await db.findFirst({
      model: "scheduleLog",
      where: { id: log.id },
    });

    const studentAttendedMs =
      updatedLog.leaveTime_student && updatedLog.joinTime_student
        ? updatedLog.leaveTime_student - updatedLog.joinTime_student
        : 0;
    const teacherAttendedMs =
      updatedLog.leaveTime_teacher && updatedLog.joinTime_teacher
        ? updatedLog.leaveTime_teacher - updatedLog.joinTime_teacher
        : 0;

    // Student completed 85%+ of the session → allow finalize even if teacher is still inside
    const studentAttendedEnough =
      updatedLog.leaveTime_student &&
      updatedLog.joinTime_student &&
      studentAttendedMs >= MIN_ATTENDANCE_MS;

    // Teacher completed 85%+ of the session → allow finalize even if student is still inside
    const teacherAttendedEnough =
      updatedLog.leaveTime_teacher &&
      updatedLog.joinTime_teacher &&
      teacherAttendedMs >= MIN_ATTENDANCE_MS;

    // Finalize if both have left OR if the leaving party has met the 85% threshold
    const bothLeft = updatedLog.leaveTime_student && updatedLog.leaveTime_teacher;
    const studentLeftEarly = role === "student" && studentAttendedEnough;
    const teacherLeftEarly = role === "teacher" && teacherAttendedEnough;

    console.log(`[leaveSession] Schedule ${id} evaluation before end_time - bothLeft: ${!!bothLeft}, studentAttendedEnough: ${studentAttendedEnough} (${studentAttendedMs}ms), teacherAttendedEnough: ${teacherAttendedEnough} (${teacherAttendedMs}ms), studentLeftEarly: ${studentLeftEarly}, teacherLeftEarly: ${teacherLeftEarly}`);

    if (bothLeft || studentLeftEarly || teacherLeftEarly) {
      console.log(`[leaveSession] Finalize conditions met for schedule ${id}. Calling finalizeSession.`);
      await finalizeSession(id, req.t);
    } else {
      console.log(`[leaveSession] Schedule ${id} remains active - waiting for session end or remaining participant.`);
    }
  }
  return successResponse({ res, req, status: 200, message: "LEFT_SUCCESS" });
});

export const submitReview = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const user = req.user;

  console.log(`[submitReview] Request received - scheduleId: ${id}, reviewerId: ${user?.id}, rating: ${rating}, comment: "${comment || ""}"`);

  const session = await db.findOne({
    model: "schedule",
    where: { id },
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
      groupStudents: { include: { student: { include: { user: true } } } },
      scheduleLogs: true,
    },
  });

  if (!session) {
    console.log(`[submitReview] Session ${id} not found.`);
    return errorResponse({
      req,
      next,
      status: 404,
      message: "SESSION_NOT_FOUND",
    });
  }

  const allowedStatuses = ["ongoing", "completed", "missed"];

  if (!allowedStatuses.includes(session.status)) {
    console.log(`[submitReview] Session ${id} status "${session.status}" not allowed for review.`);
    return errorResponse({
      req,
      next,
      status: 400,
      message: "SESSION_NOT_READY_FOR_REVIEW",
    });
  }

  const now = new Date();
  const deadline = new Date(session.end_time.getTime() + 48 * 60 * 60 * 1000);

  if (now > deadline) {
    console.log(`[submitReview] Review window expired for session ${id}. Deadline was ${deadline.toISOString()}, current time is ${now.toISOString()}`);
    return errorResponse({
      req,
      next,
      status: 400,
      message: "REVIEW_WINDOW_EXPIRED",
    });
  }

  const studentUsers = session.student?.user
    ? [session.student.user]
    : (session.groupStudents || []).map((g) => g.student?.user).filter(Boolean);

  const isStudent = studentUsers.some((u) => u.id === user.id);
  const isTeacher = user.id === session.teacher?.user?.id;

  if (!isStudent && !isTeacher) {
    console.log(`[submitReview] User ${user.id} is neither student nor teacher for session ${id}.`);
    return errorResponse({
      req,
      next,
      status: 403,
      message: "NOT_A_PARTICIPANT",
    });
  }

  let log = session.scheduleLogs?.[0];

  if (!log) {
    console.log(`[submitReview] No schedule log found for session ${id}, creating default log.`);
    log = await db.upsertOne({
      model: "scheduleLog",
      where: { scheduleId: id },
      update: {},
      create: {
        scheduleId: id,
        isStudentAttended: false,
      },
    });
  }

  const teacherActuallyAttended =
    log.isTeacherCompleted === true || Boolean(log.joinTime_teacher);

  const studentActuallyAttended = Boolean(log.joinTime_student);

  console.log(`[submitReview] Attendance check for session ${id} - teacherActuallyAttended: ${teacherActuallyAttended}, studentActuallyAttended: ${studentActuallyAttended}`);

  // الطالب الغايب ماينفعش يعمل review
  if (isStudent && !studentActuallyAttended) {
    console.log(`[submitReview] Absent student ${user.id} attempted to review session ${id}.`);
    return errorResponse({
      req,
      next,
      status: 400,
      message: "ABSENT_STUDENT_CANNOT_REVIEW",
    });
  }

  // المدرس الغايب ماينفعش يعمل review
  if (isTeacher && !teacherActuallyAttended) {
    console.log(`[submitReview] Absent teacher ${user.id} attempted to review session ${id}.`);
    return errorResponse({
      req,
      next,
      status: 400,
      message: "ABSENT_TEACHER_CANNOT_REVIEW",
    });
  }

  const existingReview = await db.findFirst({
    model: "Review",
    where: {
      scheduleId: id,
      reviewerId: user.id,
    },
  });

  if (existingReview) {
    console.log(`[submitReview] User ${user.id} already submitted a review for session ${id}.`);
    return errorResponse({
      req,
      next,
      status: 400,
      message: "ALREADY_REVIEWED",
    });
  }

  const revieweeId = isStudent
    ? session.teacher.user.id
    : (studentUsers[0]?.id || user.id);

  const role = isStudent ? "student" : "teacher";

  const effectiveStudentIds = session.isGroup
    ? (session.groupStudents || []).map((g) => g.studentId)
    : (session.studentId ? [session.studentId] : []);

  let review;

  await db.transaction(async (tx) => {
    if (log.isStudentAttended !== studentActuallyAttended) {
      console.log(`[submitReview] Updating log.isStudentAttended to ${studentActuallyAttended} for log ${log.id}`);
      await tx.updateOne({
        model: "scheduleLog",
        where: { id: log.id },
        data: { isStudentAttended: studentActuallyAttended },
      });
    }

    if (isStudent && session.status === "ongoing") {
      if (!teacherActuallyAttended) {
        console.log(`[submitReview] Teacher absent in ongoing session ${id}. Refunding student(s): ${effectiveStudentIds.join(", ")}`);
        // Teacher absent => refund all students
        for (const sId of effectiveStudentIds) {
          await tx.updateOne({
            model: "student",
            where: { id: sId },
            data: {
              sessions_remaining: { increment: 1 },
            },
          });
        }

        await tx.updateOne({
          model: "schedule",
          where: { id },
          data: {
            status: "missed",
          },
        });
      } else {
        // Teacher attended => calculate payout
        const sessionDuration =
          (session.end_time - session.start_time) / (60 * 1000 * 60);

        let payoutAmount = sessionDuration * session.teacher.hour_price;

        const isLate = log.isTeacherLate === true;

        if (isLate && log.joinTime_teacher) {
          const settings = await getSettingsData();
          const rules = settings.lateDiscountRules || [];

          const diffMinutes =
            (log.joinTime_teacher.getTime() - session.start_time.getTime()) /
            (60 * 1000);

          const sortedRules = [...rules].sort(
            (a, b) => b.lateMinutes - a.lateMinutes,
          );

          const matchedRule = sortedRules.find(
            (rule) => diffMinutes >= rule.lateMinutes,
          );

          if (matchedRule) {
            const discountFactor = 1 - matchedRule.discountPercentage / 100;
            payoutAmount = payoutAmount * discountFactor;
            console.log(`[submitReview] Applied late discount (${matchedRule.discountPercentage}% off) for teacher in session ${id}. New payout: ${payoutAmount}`);
          }
        }

        const teacherWallet = await tx.findFirst({
          model: "Wallet",
          where: {
            userId: session.teacher.user_id,
          },
        });

        if (teacherWallet) {
          console.log(`[submitReview] Crediting payout ${payoutAmount} to teacher wallet ${teacherWallet.id}`);
          await tx.updateOne({
            model: "Wallet",
            where: { id: teacherWallet.id },
            data: {
              balance: { increment: payoutAmount },
            },
          });
        }

        await tx.updateOne({
          model: "schedule",
          where: { id },
          data: {
            status: "completed",
          },
        });

        // Only count attended session if student really attended
        if (studentActuallyAttended) {
          console.log(`[submitReview] Incrementing sessions_attended for student(s): ${effectiveStudentIds.join(", ")}`);
          for (const sId of effectiveStudentIds) {
            await tx.updateOne({
              model: "student",
              where: { id: sId },
              data: {
                sessions_attended: { increment: 1 },
              },
            });
          }
        }
      }
    }

    review = await tx.create({
      model: "Review",
      data: {
        scheduleId: id,
        reviewerId: user.id,
        revieweeId,
        rating: parseInt(rating, 10),
        comment,
        role,
      },
    });
    console.log(`[submitReview] Created review record ID ${review.id} for session ${id}`);
  });

  await updateAverageRating(revieweeId);

  await createNotification({
    userId: revieweeId,
    title: req.t("NOTIFICATION_REVIEW_RECEIVED_TITLE"),
    message: req.t("NOTIFICATION_REVIEW_RECEIVED_MSG", { rating }),
    type: "review_received",
  });

  console.log(`[submitReview] Review process complete for session ${id}. Notification sent to user ${revieweeId}`);

  return successResponse({
    res,
    req,
    status: 201,
    message: "REVIEW_SUBMITTED",
    data: review,
  });
});

/* ------------------------------------------------------------------ */
/*                         Helper Functions                           */
/* ------------------------------------------------------------------ */

async function finalizeSession(scheduleId, t) {
  console.log(`[finalizeSession] Called for scheduleId: ${scheduleId}`);

  const session = await db.findOne({
    model: "schedule",
    where: { id: scheduleId },
    include: {
      scheduleLogs: true,
      student: { include: { user: true } },
      teacher: { include: { user: true } },
      groupStudents: { include: { student: { include: { user: true } } } },
    },
  });

  if (!session) {
    console.log(`[finalizeSession] Session ${scheduleId} not found.`);
    return;
  }

  if (session.status === "completed" || session.status === "missed") {
    console.log(`[finalizeSession] Session ${scheduleId} is already in terminal state "${session.status}". Skipping.`);
    return;
  }

  const log = session.scheduleLogs[0];
  if (!log) {
    console.log(`[finalizeSession] No scheduleLog found for session ${scheduleId}. Cannot finalize.`);
    return;
  }

  const SESSION_DURATION_MS = session.end_time - session.start_time;
  const MIN_ATTENDANCE_RATIO = 0.85;
  const MIN_ATTENDANCE_MS = SESSION_DURATION_MS * MIN_ATTENDANCE_RATIO;

  // Calculate actual attended duration for teacher and student
  const teacherJoined = Boolean(log.joinTime_teacher);
  const studentJoined = Boolean(log.joinTime_student);

  // If a leaveTime is recorded use it, otherwise use end_time as the cap
  const teacherLeaveTime = log.leaveTime_teacher || session.end_time;
  const studentLeaveTime = log.leaveTime_student || session.end_time;

  const teacherAttendedMs = teacherJoined
    ? teacherLeaveTime - log.joinTime_teacher
    : 0;
  const studentAttendedMs = studentJoined
    ? studentLeaveTime - log.joinTime_student
    : 0;

  const teacherAttended = teacherAttendedMs >= MIN_ATTENDANCE_MS;
  const studentAttended = studentAttendedMs >= MIN_ATTENDANCE_MS;
  const bothAttended = teacherAttended && studentAttended;

  console.log(`[finalizeSession] Attendance stats for schedule ${scheduleId} - durationMs: ${SESSION_DURATION_MS}, minReqMs: ${MIN_ATTENDANCE_MS} | teacherJoined: ${teacherJoined}, teacherAttendedMs: ${teacherAttendedMs}, teacherAttended: ${teacherAttended} | studentJoined: ${studentJoined}, studentAttendedMs: ${studentAttendedMs}, studentAttended: ${studentAttended} | bothAttended: ${bothAttended}`);

  const studentUserIds = session.student?.user_id
    ? [session.student.user_id]
    : (session.groupStudents || []).map((g) => g.student?.user_id).filter(Boolean);

  const studentName = session.isGroup
    ? `عدد ${session.groupStudents?.length || 0} طلاب`
    : (session.student?.user?.name || "Student");

  /* ────────────────────────────────────────────────────────────
   * PATH A: Both attended 85%+ → completed
   * ──────────────────────────────────────────────────────────── */
  if (bothAttended) {
    console.log(`[finalizeSession] PATH A: Both attended >= 85%. Completing session ${scheduleId}.`);
    const sessionDurationHours = SESSION_DURATION_MS / (60 * 1000 * 60);
    let payoutAmount = sessionDurationHours * (session.teacher?.hour_price || 0);

    // Apply late-teacher discount if applicable
    if (log?.isTeacherLate && log?.joinTime_teacher) {
      const { getSettingsData } = await import("../Settings/settings.controller.js");
      const settings = await getSettingsData();
      const rules = settings.lateDiscountRules || [];
      const diffMinutes = (log.joinTime_teacher.getTime() - session.start_time.getTime()) / 60000;
      const sortedRules = [...rules].sort((a, b) => b.lateMinutes - a.lateMinutes);
      const matchedRule = sortedRules.find((r) => diffMinutes >= r.lateMinutes);
      if (matchedRule) {
        payoutAmount *= 1 - matchedRule.discountPercentage / 100;
        console.log(`[finalizeSession] Applied late discount (${matchedRule.discountPercentage}%) for teacher in session ${scheduleId}. Payout: ${payoutAmount}`);
      }
    }

    const effectiveStudentIds = session.isGroup
      ? (session.groupStudents || []).map((g) => g.studentId)
      : session.studentId
      ? [session.studentId]
      : [];

    await db.transaction(async (tx) => {
      await tx.updateOne({
        model: "schedule",
        where: { id: scheduleId },
        data: { status: "completed" },
      });

      if (payoutAmount > 0) {
        const teacherWallet = await tx.findFirst({
          model: "Wallet",
          where: { userId: session.teacher.user_id },
        });
        if (teacherWallet) {
          console.log(`[finalizeSession] Crediting payout ${payoutAmount} to teacher wallet ${teacherWallet.id}`);
          await tx.updateOne({
            model: "Wallet",
            where: { id: teacherWallet.id },
            data: { balance: { increment: payoutAmount } },
          });
        }
      }

      for (const sId of effectiveStudentIds) {
        await tx.updateOne({
          model: "student",
          where: { id: sId },
          data: { sessions_attended: { increment: 1 } },
        });
      }

      if (log) {
        await tx.updateOne({
          model: "scheduleLog",
          where: { id: log.id },
          data: { isTeacherCompleted: true, isStudentAttended: true },
        });
      }
    });

    if (session.teacher?.user_id) {
      await createNotification({
        userId: session.teacher.user_id,
        title: t ? t("NOTIFICATION_SESSION_COMPLETED_TITLE") : "تم إتمام الجلسة",
        message: t
          ? t("NOTIFICATION_SESSION_COMPLETED_MSG", { title: session.title })
          : `تم إتمام الجلسة "${session.title}" تلقائياً وإضافة المكافأة لمحفظتك.`,
        type: "session_completed",
      });
    }
    for (const uId of studentUserIds) {
      await createNotification({
        userId: uId,
        title: t ? t("NOTIFICATION_SESSION_COMPLETED_TITLE") : "تم إتمام الجلسة",
        message: t
          ? t("NOTIFICATION_SESSION_COMPLETED_MSG", { title: session.title })
          : `تم إتمام الجلسة "${session.title}" بنجاح.`,
        type: "session_completed",
      });
    }

    await createAdminNotification({
      title: "تم إتمام الجلسة تلقائياً",
      message: `تم إتمام الجلسة "${session.title}" بين الطالب: ${studentName} والمدرس: ${session.teacher?.user?.name || "Teacher"}.`,
      type: "session_completed",
    });
    console.log(`[finalizeSession] Session ${scheduleId} finalized successfully as COMPLETED.`);
    return;
  }

  /* ────────────────────────────────────────────────────────────
   * PATH B: One or both didn't meet 85% → missed
   * ──────────────────────────────────────────────────────────── */
  // Only mark missed if NEITHER joined at all, OR if it's confirmed both have left
  // and at least one didn't meet the threshold.
  const bothLeft = Boolean(log.leaveTime_student && log.leaveTime_teacher);
  const sessionEnded = new Date() >= session.end_time;
  const neitherJoined = !studentJoined && !teacherJoined;

  console.log(`[finalizeSession] PATH B Check for schedule ${scheduleId} - neitherJoined: ${neitherJoined}, bothLeft: ${bothLeft}, sessionEnded: ${sessionEnded}`);

  if (neitherJoined || bothLeft || sessionEnded) {
    const shouldRefund = !teacherAttended; // teacher didn't attend → refund student
    console.log(`[finalizeSession] Marking session ${scheduleId} as MISSED. shouldRefund: ${shouldRefund}`);

    const effectiveStudentIds = session.isGroup
      ? (session.groupStudents || []).map((g) => g.studentId)
      : session.studentId
      ? [session.studentId]
      : [];

    await db.transaction(async (tx) => {
      await tx.updateOne({
        model: "schedule",
        where: { id: scheduleId },
        data: { status: "missed" },
      });

      if (shouldRefund && effectiveStudentIds.length > 0) {
        console.log(`[finalizeSession] Refunding remaining sessions for student(s): ${effectiveStudentIds.join(", ")}`);
        for (const sId of effectiveStudentIds) {
          await tx.updateOne({
            model: "student",
            where: { id: sId },
            data: { sessions_remaining: { increment: 1 } },
          });
        }
      }
    });

    for (const uId of studentUserIds) {
      await createNotification({
        userId: uId,
        title: t ? t("NOTIFICATION_SESSION_MISSED_TITLE") : "جلسة فائتة",
        message: t
          ? t("NOTIFICATION_SESSION_MISSED_MSG", { title: session.title })
          : `تم اعتبار الجلسة "${session.title}" فائتة.`,
        type: "session_missed",
      });
    }

    let reasonNote = "";
    if (!teacherAttended && !studentAttended) {
      reasonNote = " (لم يحضر أي طرف بما يكفي)";
    } else if (!teacherAttended) {
      reasonNote = " (المعلم لم يحضر بما يكفي — تم رد الجلسة للطالب)";
    } else {
      reasonNote = " (الطالب لم يحضر بما يكفي)";
    }

    await createAdminNotification({
      title: "تم تفويت الجلسة",
      message: `تم تفويت الجلسة "${session.title}" بين الطالب: ${studentName} والمدرس: ${session.teacher?.user?.name || "Teacher"}${reasonNote}.`,
      type: "session_missed",
    });
  }
}

async function updateAverageRating(userId) {
  const reviews = await db.findMany({
    model: "Review",
    where: { revieweeId: userId, isHidden: false },
  });

  if (reviews.length === 0) return;

  const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = totalRating / reviews.length;

  // Try updating teacher
  const teacher = await db.findFirst({
    model: "teacher",
    where: { user_id: userId },
  });
  if (teacher) {
    await db.updateOne({
      model: "teacher",
      where: { id: teacher.id },
      data: { avgRating: avg, totalReviews: reviews.length },
    });
  } else {
    // Try updating student
    const student = await db.findFirst({
      model: "student",
      where: { user_id: userId },
    });
    if (student) {
      await db.updateOne({
        model: "student",
        where: { id: student.id },
        data: { avgRating: avg, totalReviews: reviews.length },
      });
    }
  }
}
