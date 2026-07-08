import { Router } from "express";
import { authentication } from "../../Middlewares/Authentication.js";
import { authorizeResource } from "../../Middlewares/AuthorizationMiddleware.js";
import * as teacherController from "./teachers.controller.js";
import { validation } from "../../Middlewares/Validation.js";
import {
  createTeacherSchema,
  getAllTeachersSchema,
  getTeacherSchema,
  updateTeacherSchema,
  deleteTeacherSchema,
  getTeacherStatsSchema,
} from "./teachers.validation.js";
import subjectsRouter from "./subjects/subjects.routes.js";

const router = Router();
router.use("/subjects", subjectsRouter);

router.get(
  "/",
  authentication(),
  authorizeResource("teachers"),
  validation(getAllTeachersSchema),
  teacherController.getAllTeachers,
);

router.get(
  "/my-students",
  authentication(),
  authorizeResource("teachers"),
  teacherController.getMyStudents,
);

router.get(
  "/export",
  authentication(),
  authorizeResource("teachers"),
  teacherController.exportTeachersCsv,
);

router.post(
  "/create",
  authentication(),
  authorizeResource("teachers"),
  validation(createTeacherSchema),
  teacherController.createTeacher,
);

router.get(
  "/:id",
  authentication(),
  authorizeResource("teachers"),
  validation(getTeacherSchema),
  teacherController.getTeacher,
);
router.get(
  "/stats/:id",
  authentication(),
  authorizeResource("teachers"),
  validation(getTeacherStatsSchema),
  teacherController.getTeacherStats,
);

router.patch(
  "/update/:id",
  authentication(),
  authorizeResource("teachers"),
  validation(updateTeacherSchema),
  teacherController.updateTeacher,
);

router.delete(
  "/delete/:id",
  authentication(),
  authorizeResource("teachers"),
  validation(deleteTeacherSchema),
  teacherController.deleteTeacher,
);

export default router;
