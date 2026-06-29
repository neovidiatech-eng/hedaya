import {
  asyncHandler,
  successResponse,
  errorResponse,
} from "../../Utils/Response.js";
import * as db from "../../database/dbService.js";
import { normalizeDate, formatSchedules } from "../../Utils/Helpers.js";
import {
  addNotificationJob,
  removeNotificationJob,
} from "../../Utils/Workers/notifications.js";
import { notificationType } from "../../Utils/Enums/sessions.js";
import { createAdminNotification } from "../Notifications/notifications.controller.js";


// 1. Create Request (Teacher/Student)
export const createRequest = asyncHandler(async (req, res, next) => {
  const { sessionId, type, reason, requestedData } = req.body;
  const requesterId = req.user.id;
  const requesterRole = req.user.role.name;

  // If session-related request, verify session exists
  if (sessionId) {
    const session = await db.findOne({
      model: "schedule",
      where: { id: sessionId },
    });
    if (!session) {
      return errorResponse({
        req,
        next,
        status: 404,
        message: "SESSION_NOT_FOUND",
      });
    }
  }
  const request = await db.create({
    model: "session_request",
    data: {
      sessionId,
      requesterId,
      requesterRole,
      type,
      reason,
      requestedData,
      status: "pending",
    },
  });

  // Create Audit Log
  await db.create({
    model: "audit_log",
    data: {
      entityType: "request",
      entityId: request.id,
      action: "create",
      userId: requesterId,
      changes: { type, sessionId },
    },
  });

  const requester = await db.findOne({
    model: "user",
    where: { id: requesterId }
  });

  await createAdminNotification({
    title: "تم تقديم طلب جلسة جديد",
    message: `تم تقديم طلب جلسة (${type}) من ${requester?.name || "User"} (${requesterRole}).`,
    type: "session_request_created",
  });

  return successResponse({
    res,
    req,
    data: request,
    status: 201,
    message: "REQUEST_SUBMITTED", // You'll need to add this to en/ar.json
  });
});

// 2. Get All Requests (Admin)
export const getAllRequests = asyncHandler(async (req, res, next) => {
  const { status, type } = req.query;
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const requests = await db.findMany({
    model: "session_request",
    where,
    include: {
      requester: { select: { name: true, email: true } },
      schedule: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedRequests = requests.map((request) => ({
    ...request,
    schedule: request.schedule
      ? formatSchedules(request.schedule, req.timezone)
      : request.schedule,
  }));

  return successResponse({ res, data: formattedRequests });
});

// 3. Approve Request (Admin)
export const approveRequest = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { adminNotes } = req.body;
  const adminId = req.user.id;

  let oldSessionIdToRemove = null;
  let newSessionToAdd = null;

  const request = await db.findOne({
    model: "session_request",
    where: { id },
    include: { schedule: true },
  });

  if (!request) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "REQUEST_NOT_FOUND",
    });
  }

  if (request.status !== "pending") {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "REQUEST_ALREADY_PROCESSED",
    });
  }

  const { type, sessionId, requestedData } = request;

  await db.transaction(async (tx) => {
    // 1. Update Request Status
    await tx.updateOne({
      model: "session_request",
      where: { id },
      data: { status: "approved", adminId, adminNotes },
    });

    // 2. Process based on type
    if (type === "reschedule" && sessionId) {
      const oldSession = request.schedule;

      if (!oldSession) {
        throw new Error("RELATED_SESSION_NOT_FOUND");
      }

      const startTime = normalizeDate(requestedData.new_start_time, req.timezone);
      const endTime = normalizeDate(requestedData.new_end_time, req.timezone);

      // Conflict check
      const teacher_conflict = await tx.findFirst({
        model: "schedule",
        where: {
          teacherId: oldSession.teacherId,
          status: { not: "cancelled" },
          start_time: { lt: endTime },
          end_time: { gt: startTime },
        },
      });
      const student_conflict = await tx.findFirst({
        model: "schedule",
        where: {
          studentId: oldSession.studentId,
          status: { not: "cancelled" },
          start_time: { lt: endTime },
          end_time: { gt: startTime },
        },
      });

      if (teacher_conflict || student_conflict) {
        throw new Error("SESSION_CONFLICT");
      }

      // Create new rescheduled session
      const newSession = await tx.create({
        model: "schedule",
        data: {
          teacherId: oldSession.teacherId,
          studentId: oldSession.studentId,
          subjectId: oldSession.subjectId,
          title: oldSession.title,
          description: oldSession.description,
          link: oldSession.link,
          start_time: startTime,
          end_time: endTime,
          notes: requestedData.suggested_notes || oldSession.notes,
          rescheduledFromId: oldSession.id,
          status: "scheduled",
        },
      });

      // Delete old session
      await tx.deleteOne({
        model: "schedule",
        where: { id: oldSession.id },
      });

      oldSessionIdToRemove = oldSession.id;
      newSessionToAdd = {
        id: newSession.id,
        studentId: oldSession.studentId,
        startTime,
        notification_Time: requestedData.notification_Time,
      };
    } else if (type === "cancel" && sessionId) {
      await tx.updateOne({
        model: "schedule",
        where: { id: sessionId },
        data: { status: "cancelled" },
      });

      // Refund session count to student
      const session = await tx.findOne({
        model: "schedule",
        where: { id: sessionId },
      });
      await tx.updateOne({
        model: "student",
        where: { id: session.studentId },
        data: { sessions_remaining: { increment: 1 } },
      });

      oldSessionIdToRemove = sessionId;
    } else if (type === "new_session") {
      const startTime = normalizeDate(requestedData.new_start_time, req.timezone);
      const endTime = normalizeDate(requestedData.new_end_time, req.timezone);
      const teacherId = requestedData.teacherId || request.requesterId;
      const studentId = requestedData.studentId;

      // Conflict check
      const teacher_conflict = await tx.findFirst({
        model: "schedule",
        where: {
          teacherId,
          status: { not: "cancelled" },
          start_time: { lt: endTime },
          end_time: { gt: startTime },
        },
      });
      const student_conflict = await tx.findFirst({
        model: "schedule",
        where: {
          studentId,
          status: { not: "cancelled" },
          start_time: { lt: endTime },
          end_time: { gt: startTime },
        },
      });

      if (teacher_conflict || student_conflict) {
        throw new Error("SESSION_CONFLICT");
      }

      const newSession = await tx.create({
        model: "schedule",
        data: {
          teacherId,
          studentId,
          subjectId: requestedData.subjectId,
          title: requestedData.title || req.t("NEW_SESSION_TITLE"),
          description: req.t("SESSION_CREATED_VIA_REQUEST"),
          link: "",
          start_time: startTime,
          end_time: endTime,
          notes: requestedData.suggested_notes,
          status: "scheduled",
        },
      });

      newSessionToAdd = {
        id: newSession.id,
        studentId,
        startTime,
        notification_Time: requestedData.notification_Time,
      };
    } else if (type === "absence_correction" && sessionId) {
      await tx.updateOne({
        model: "schedule",
        where: { id: sessionId },
        data: { status: requestedData.new_status },
      });
    }

    // 3. Create Audit Log
    await tx.create({
      model: "audit_log",
      data: {
        entityType: "request",
        entityId: id,
        action: "approve",
        userId: adminId,
        changes: { from: "pending", to: "approved" },
      },
    });
  });

  // Post-transaction Redis operations for notification jobs
  if (oldSessionIdToRemove) {
    try {
      await removeNotificationJob(oldSessionIdToRemove);
    } catch (err) {
      console.error(`Failed to remove notification job for session ${oldSessionIdToRemove}:`, err);
    }
  }

  if (newSessionToAdd) {
    try {
      const { id: newSessionId, studentId, startTime, notification_Time } = newSessionToAdd;
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
        await addNotificationJob({
          scheduleId: newSessionId,
          studentId,
          type: notificationJobType,
          sendAt: reminderTime,
        });
      }
    } catch (err) {
      console.error("Failed to add notification job for new session:", err);
    }
  }

  const requester = await db.findOne({
    model: "user",
    where: { id: request.requesterId }
  });

  await createAdminNotification({
    title: "تم قبول طلب جلسة",
    message: `تم قبول طلب جلسة (${request.type}) من ${requester?.name || "User"}.`,
    type: "session_request_approved",
  });

  return successResponse({
    res,
    req,
    message: "REQUEST_APPROVED",
  });
});

// 4. Reject Request (Admin)
export const rejectRequest = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { adminNotes } = req.body;
  const adminId = req.user.id;

  const request = await db.findOne({ model: "session_request", where: { id } });
  if (!request) {
    return errorResponse({
      req,
      next,
      status: 404,
      message: "REQUEST_NOT_FOUND",
    });
  }

  if (request.status !== "pending") {
    return errorResponse({
      req,
      next,
      status: 400,
      message: "REQUEST_ALREADY_PROCESSED",
    });
  }

  await db.updateOne({
    model: "session_request",
    where: { id },
    data: { status: "rejected", adminId, adminNotes },
  });

  const requester = await db.findOne({
    model: "user",
    where: { id: request.requesterId }
  });

  await createAdminNotification({
    title: "تم رفض طلب جلسة",
    message: `تم رفض طلب جلسة (${request.type}) من ${requester?.name || "User"}.`,
    type: "session_request_rejected",
  });

  return successResponse({
    res,
    req,
    message: "REQUEST_REJECTED",
  });
});

export const getMyRequests = asyncHandler(async (req, res, next) => {
  const { status, type } = req.query;
  const user = req.user.id;

  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  const requests = await db.findMany({
    model: "session_request",
    where: {
      requesterId: user,
      ...where,
    },
    include: {
      schedule: true,
      requester: true,
    },
  });

  const formattedRequests = requests.map((request) => ({
    ...request,
    schedule: request.schedule
      ? formatSchedules(request.schedule, req.timezone)
      : request.schedule,
  }));

  return successResponse({ res, data: formattedRequests });
});
