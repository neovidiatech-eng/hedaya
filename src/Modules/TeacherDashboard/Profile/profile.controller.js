import { formatSchedules, getNowUTC } from "../../../Utils/Date/time.js";
import {
  asyncHandler,
  errorResponse,
  successResponse,
} from "../../../Utils/Response.js";
import { decryptText, looksEncrypted } from "../../../Utils/Security/index.js";
import * as db from "../../../database/dbService.js";

export const getProfile = asyncHandler(async (req, res, next) => {
  if (!req?.user?.id) {
    return errorResponse({
      next,
      req,
      status: 401,
      message: "UNAUTHORIZED",
    });
  }

  const user = await db.findOne({
    model: "teacher",
    where: { user_id: req.user.id },
    include: {
      user: {
        include: {
          wallet: {
            include: {
              transactions: {
                orderBy: { createdAt: "desc" },
              },
              currency: true,
            },
          },
        },
      },
      schedules: {
        include: {
          teacher: true,
          subject: true,
          student: { include: { user: true } },
        },
      },
      teacherSubjects: { include: { subject: true } },
    },
  });

  if (!user) {
    return errorResponse({
      next,
      req,
      status: 404,
      message: "TEACHER_NOT_FOUND",
    });
  }

  const decTeacherPhone = user?.user?.phone
    ? (looksEncrypted(user.user.phone) ? await decryptText({ text: user.user.phone }) : user.user.phone)
    : "";

  const schedules = user?.schedules || [];
  for (const schedule of schedules) {
    if (schedule?.student?.user?.phone) {
      schedule.student.user.phone = looksEncrypted(schedule.student.user.phone)
        ? await decryptText({ text: schedule.student.user.phone })
        : schedule.student.user.phone;
    }
  }

  const students = Object.values(
    schedules.reduce((acc, item) => {
      const student = item?.student;
      if (student && student.id && !acc[student.id]) {
        const studentUser = student.user || {};
        const codeCountry = studentUser.code_country || "";
        const phone = studentUser.phone || "";
        acc[student.id] = {
          id: student.id,
          name: studentUser.name || "",
          code: `STU-${student.id.slice(0, 3)}`,
          email: studentUser.email || "",
          phone: phone ? `${codeCountry}${phone}` : "",
          subject: item?.subject ? {
            name: item.subject.name_en || item.subject.name_ar || "",
            code: `SUB-${item.subject.id ? item.subject.id.slice(0, 3) : ""}`,
          } : null,
          sessions: `${student.sessions_attended ?? 0}/${student.sessions ?? 0}`,
        };
      }
      return acc;
    }, {}),
  );

  const teacherSubjects = user?.teacherSubjects || [];

  const mapped = {
    teacher: {
      id: user.id,
      user_id: user.user_id,
      name: user.user?.name || "",
      email: user.user?.email || "",
      meeting_link: user.meeting_link || "",
      phone: `${user.user?.code_country || ""} ${decTeacherPhone}`.trim(),
      gender: user.gender || null,
      hourPrice: user.hour_price ?? 0,
      status: user.user?.status || null,
      active: user.active ?? false,
      wallet: user.user?.wallet || null,
    },
    stats: {
      totalStudents: students.length,
      totalSubjects: teacherSubjects.length,
      totalSessions: schedules.length,
    },
    subjects: teacherSubjects.map((ts) => ({
      nameEn: ts?.subject?.name_en || "",
      nameAr: ts?.subject?.name_ar || "",
      color: ts?.subject?.color || "",
      active: ts?.subject?.active ?? false,
    })),
    schedules: formatSchedules(schedules, req?.timezone).map((s) => ({
      title: s?.title || "",
      description: s?.description || "",
      type: s?.type || "",
      status: s?.status || "",
      startTime: s?.start_time || null,
      endTime: s?.end_time || null,
      display_start_time: s?.display_start_time || "",
      display_end_time: s?.display_end_time || "",
      display_timezone: s?.display_timezone || "",
      isRecurring: s?.is_recurring ?? false,
      link: s?.link || "",
      notes: s?.notes || "",
      subject: s?.subject ? {
        nameEn: s.subject.name_en || "",
        nameAr: s.subject.name_ar || "",
        color: s.subject.color || "",
      } : null,
      student: s?.student ? {
        name: s.student.user?.name || "",
        email: s.student.user?.email || "",
        gender: s.student.gender || null,
        country: s.student.country || null,
        status: s.student.status || null,
        sessions: {
          total: s.student.sessions ?? 0,
          attended: s.student.sessions_attended ?? 0,
          remaining: s.student.sessions_remaining ?? 0,
        },
      } : null,
    })),
    students,
  };

  return successResponse({
    res,
    req,
    data: mapped,
    status: 200,
    message: "FETCH_SUCCESS",
  });
});

export const getDashboardStats = asyncHandler(async (req, res, next) => {
  if (!req?.user?.id) {
    return errorResponse({
      next,
      req,
      status: 401,
      message: "UNAUTHORIZED",
    });
  }

  const user = await db.findOne({
    model: "teacher",
    where: { user_id: req.user.id },
    include: {
      user: {
        include: {
          wallet: {
            include: {
              transactions: {
                orderBy: { createdAt: "desc" },
              },
              currency: true,
            },
          },
        },
      },
      schedules: {
        include: {
          teacher: true,
          subject: true,
          student: { include: { user: true } },
        },
      },
      teacherSubjects: { include: { subject: true } },
    },
  });

  if (!user) {
    return errorResponse({
      next,
      req,
      status: 404,
      message: "TEACHER_NOT_FOUND",
    });
  }

  const now = getNowUTC();

  // Day boundaries in UTC
  const startOfDay = now.startOf("day").toDate();
  const endOfDay = now.endOf("day").toDate();

  const todaySchedules = await db.findMany({
    model: "schedule",
    where: {
      teacherId: user.id,
      start_time: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const decTeacherPhone = user?.user?.phone
    ? (looksEncrypted(user.user.phone) ? await decryptText({ text: user.user.phone }) : user.user.phone)
    : "";

  const schedules = user?.schedules || [];
  for (const schedule of schedules) {
    if (schedule?.student?.user?.phone) {
      schedule.student.user.phone = looksEncrypted(schedule.student.user.phone)
        ? await decryptText({ text: schedule.student.user.phone })
        : schedule.student.user.phone;
    }
  }

  const students = Object.values(
    schedules.reduce((acc, item) => {
      const student = item?.student;
      if (student && student.id && !acc[student.id]) {
        const studentUser = student.user || {};
        const codeCountry = studentUser.code_country || "";
        const phone = studentUser.phone || "";
        acc[student.id] = {
          id: student.id,
          name: studentUser.name || "",
          code: `STU-${student.id.slice(0, 3)}`,
          email: studentUser.email || "",
          phone: phone ? `${codeCountry}${phone}` : "",
          subject: item?.subject ? {
            name: item.subject.name_en || item.subject.name_ar || "",
            code: `SUB-${item.subject.id ? item.subject.id.slice(0, 3) : ""}`,
          } : null,
          sessions: `${student.sessions_attended ?? 0}/${student.sessions ?? 0}`,
        };
      }
      return acc;
    }, {}),
  );

  const teacherSubjects = user?.teacherSubjects || [];

  return successResponse({
    res,
    req,
    data: {
      stats: {
        totalStudents: students.length,
        totalSubjects: teacherSubjects.length,
        totalSessions: schedules.length,
      },
      subjects: teacherSubjects.map((ts) => ({
        nameEn: ts?.subject?.name_en || "",
        nameAr: ts?.subject?.name_ar || "",
        color: ts?.subject?.color || "",
        active: ts?.subject?.active ?? false,
      })),
      schedules: formatSchedules(schedules, req?.timezone).map((s) => ({
        title: s?.title || "",
        description: s?.description || "",
        type: s?.type || "",
        status: s?.status || "",
        startTime: s?.start_time || null,
        endTime: s?.end_time || null,
        display_start_time: s?.display_start_time || "",
        display_end_time: s?.display_end_time || "",
        display_timezone: s?.display_timezone || "",
        isRecurring: s?.is_recurring ?? false,
        link: s?.link || "",
        notes: s?.notes || "",
        subject: s?.subject ? {
          nameEn: s.subject.name_en || "",
          nameAr: s.subject.name_ar || "",
          color: s.subject.color || "",
        } : null,
        student: s?.student ? {
          name: s.student.user?.name || "",
          email: s.student.user?.email || "",
          gender: s.student.gender || null,
          country: s.student.country || null,
          status: s.student.status || null,
          sessions: {
            total: s.student.sessions ?? 0,
            attended: s.student.sessions_attended ?? 0,
            remaining: s.student.sessions_remaining ?? 0,
          },
        } : null,
      })),
      todaySchedules: formatSchedules(todaySchedules || [], req?.timezone),
      students,
    },
    status: 200,
    message: "FETCH_SUCCESS",
  });
});

export const updateProfileMeetingLink = asyncHandler(async (req, res, next) => {
  if (!req?.user?.id) {
    return errorResponse({
      next,
      req,
      status: 401,
      message: "UNAUTHORIZED",
    });
  }

  const { meeting_link } = req.body;

  const user = await db.findOne({
    model: "teacher",
    where: { user_id: req.user.id },
  });

  if (!user) {
    return errorResponse({
      next,
      req,
      status: 404,
      message: "TEACHER_NOT_FOUND",
    });
  }

  const updatedUser = await db.updateOne({
    model: "teacher",
    where: { id: user.id },
    data: { meeting_link },
  });

  return successResponse({
    res,
    req,
    data: updatedUser,
    status: 200,
    message: "FETCH_SUCCESS",
  });
});
