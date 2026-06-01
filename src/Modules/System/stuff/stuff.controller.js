import {
  asyncHandler,
  successResponse,
  errorResponse,
} from "../../../Utils/Response.js";
import * as db from "../../../database/dbService.js";
import { ensureExists } from "../../../database/genericService.js";
import {
  decryptPasswordForResponse,
  decryptText,
  encryptPassword,
  encryptText,
  looksEncrypted,
} from "../../../Utils/Security/index.js";
import { redis } from "../../../Utils/Radis/Connection.js";

export const getAllStuff = asyncHandler(async (req, res, next) => {
  const { search, page = 1, limit = 10 } = req.query;

  const where = {};
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const { items: stuff, pagination } = await db.findManyWithPaginationAndCount({
    model: "stuff",
    where,
    page,
    limit,
    include: {
      user: true,
      role: true,
    },
  });

  const stuffData = await Promise.all(
    stuff.map(async (item) => ({
      ...item,
      user: item.user
        ? {
            ...item.user,
            password: await decryptPasswordForResponse(item.user.password),
            phone: looksEncrypted(item.user.phone)
              ? await decryptText({ text: item.user.phone })
              : item.user.phone,
          }
        : item.user,
    })),
  );

  return successResponse({
    res,
    req,
    message: "FETCH_SUCCESS",
    data: { stuff: stuffData, pagination },
  });
});

export const getStuffById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Single query with nested includes for permissions
  const stuff = await ensureExists({
    model: "stuff",
    where: { id },
    include: {
      user: true,
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
    message: "USER_NOT_FOUND",
  });

  const permissions =
    stuff.role?.rolePermissions.map((rp) => rp.permission) || [];

  if (stuff?.user) {
    stuff.user.password = await decryptPasswordForResponse(stuff.user.password);
    stuff.user.phone = looksEncrypted(stuff.user.phone)
      ? await decryptText({ text: stuff.user.phone })
      : stuff.user.phone;
  }

  return successResponse({
    res,
    req,
    message: "FETCH_SUCCESS",
    data: {
      stuff,
      permissions,
    },
  });
});

export const createStuffUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, codeCountry, code_country, roleId } =
    req.body;
  const userCodeCountry = codeCountry || code_country;

  const [checkUserByEmail, checkUserByPhone, checkRole] = await Promise.all([
    db.findOne({ model: "user", where: { email } }),
    db.findFirst({ model: "user", where: { phone } }),
    roleId
      ? db.findOne({ model: "role", where: { id: roleId } })
      : Promise.resolve(null),
  ]);

  if (checkUserByEmail)
    return errorResponse({ req, next, message: "EMAIL_EXISTS", status: 400 });
  if (checkUserByPhone)
    return errorResponse({ req, next, message: "PHONE_EXISTS", status: 400 });
  if (roleId && !checkRole)
    return errorResponse({ req, next, message: "ROLE_NOT_FOUND", status: 404 });

  const encryptedPassword = encryptPassword({ password });

  const result = await db.transaction([
    db.create({
      model: "user",
      data: {
        email,
        password: encryptedPassword,
        name,
        phone,
        code_country: userCodeCountry,
        roleId: roleId || null,
        status: "active",
        confirmAt: new Date(),
      },
    }),
  ]);

  const user = result[0];

  const newStuff = await db.create({
    model: "stuff",
    data: {
      user: { connect: { id: user.id } },
      role: roleId ? { connect: { id: roleId } } : undefined,
    },
    include: { user: true, role: true },
  });

  if (newStuff?.user) {
    newStuff.user.password = await decryptPasswordForResponse(
      newStuff.user.password,
    );
    newStuff.user.phone = looksEncrypted(newStuff.user.phone)
      ? await decryptText({ text: newStuff.user.phone })
      : newStuff.user.phone;
  }

  return successResponse({
    res,
    req,
    message: "CREATE_SUCCESS",
    status: 201,
    data: newStuff,
  });
});

export const updateStuffUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, email, password, phone, code_country, roleId } = req.body;

  const stuff = await ensureExists({
    model: "stuff",
    where: { id },
    include: { user: true },
  });

  if (email && email !== stuff.user.email) {
    const existing = await db.findOne({ model: "user", where: { email } });
    if (existing)
      return errorResponse({ req, next, message: "EMAIL_EXISTS", status: 400 });
  }

  if (phone && phone !== stuff.user.phone) {
    const existing = await db.findFirst({ model: "user", where: { phone } });
    if (existing)
      return errorResponse({ req, next, message: "PHONE_EXISTS", status: 400 });
  }

  const encryptedPassword = password ? encryptPassword({ password }) : null;

  // Update user data
  if (
    name ||
    email ||
    encryptedPassword ||
    phone ||
    code_country ||
    roleId !== undefined
  ) {
    await db.updateOne({
      model: "user",
      where: { id: stuff.user_id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(encryptedPassword && { password: encryptedPassword }),
        ...(phone && { phone }),
        ...(code_country && { code_country }),
        ...(roleId !== undefined && { roleId }),
      },
    });
  }

  const updatedStuff = await db.updateOne({
    model: "stuff",
    where: { id },
    data: {
      ...(roleId !== undefined && {
        role: roleId ? { connect: { id: roleId } } : { disconnect: true },
      }),
    },
    include: {
      user: true,
      role: true,
    },
  });

  if (updatedStuff?.user) {
    updatedStuff.user.password = await decryptPasswordForResponse(
      updatedStuff.user.password,
    );
    updatedStuff.user.phone = looksEncrypted(updatedStuff.user.phone)
      ? await decryptText({ text: updatedStuff.user.phone })
      : updatedStuff.user.phone;
  }

  return successResponse({
    res,
    req,
    message: "UPDATE_SUCCESS",
    data: updatedStuff,
  });
});

export const deleteStuffUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const stuff = await ensureExists({ model: "stuff", where: { id } });

  // Delete user (cascades to stuff)
  await db.deleteOne({ model: "user", where: { id: stuff.user_id } });

  return successResponse({
    res,
    req,
    message: "DELETE_SUCCESS",
  });
});

export const registerParent = asyncHandler(async (req, res, next) => {
  const {
    name,
    email,
    password,
    phone,
    codeCountry,
    country,
    timezone,
    students,
  } = req.body;

  const [checkUserByEmail, checkUserByPhone] = await Promise.all([
    db.findFirst({ model: "user", where: { email } }),
    db.findFirst({ model: "user", where: { phone } }),
  ]);

  const userRole = await db.upsertOne({
    model: "role",
    where: { name: "parent" },
    update: {},
    create: {
      name: "parent",
    },
  });

  if (checkUserByEmail) {
    return errorResponse({ req, next, message: "EMAIL_EXISTS", status: 400 });
  }

  if (checkUserByPhone) {
    return errorResponse({ req, next, message: "PHONE_EXISTS", status: 400 });
  }

  const encryptedPassword = encryptPassword({ password });
  const encryptedPhone = encryptText({ text: phone });

  await db.transaction(async (tx) => {
    const user = await tx.create({
      model: "user",
      data: {
        name,
        email,
        password: encryptedPassword,
        phone: encryptedPhone,
        code_country: codeCountry,
        timezone,
        roleId: userRole.id,
        confirmAt: new Date(),
        status: "active",
      },
    });

    const parentStudents = await Promise.all(
      students.map(async (studentId) => {
        const checkStudent = await tx.findFirst({
          model: "student",
          where: { id: studentId },
        });

        if (!checkStudent) {
          return errorResponse({
            req,
            next,
            message: "STUDENT_NOT_FOUND",
            status: 404,
          });
        }

        const student = await tx.create({
          model: "parentStudent",
          data: {
            parent: { connect: { id: user.id } },
            student: { connect: { id: studentId } },
          },
        });
      }),
    );
  });

  return successResponse({
    res,
    req,
    status: 201,
    message: "PARENT_REGISTER_SUCCESS",
  });
});
