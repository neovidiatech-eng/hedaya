import { Router } from "express";
import { authentication } from "../../Middlewares/Authentication.js";
import { authorizeResource } from "../../Middlewares/AuthorizationMiddleware.js";
import { validation } from "../../Middlewares/Validation.js";
import {
  createStudentSchema,
  updateStudentSchema,
  studentIdSchema,
} from "./students.validation.js";
import * as studentController from "../Students/students.controller.js";

const router = Router();

router.get(
  "/",
  authentication(),
  authorizeResource("students"),
  studentController.getAllStudents,
);

router.get(
  "/stats",
  authentication(),
  authorizeResource("students"),
  studentController.getStudentsStats,
);

router.post(
  "/create",
  authentication(),
  authorizeResource("students"),
  validation(createStudentSchema),
  studentController.createStudent,
);

router.get(
  "/:id",
  authentication(),
  authorizeResource("students"),
  validation(studentIdSchema),
  studentController.getStudentById,
);

router.patch(
  "/update/:id",
  authentication(),
  authorizeResource("students"),
  validation(updateStudentSchema),
  studentController.updateStudent,
);

router.delete(
  "/:id",
  authentication(),
  authorizeResource("students"),
  validation(studentIdSchema),
  studentController.deleteStudent,
);

export default router;
