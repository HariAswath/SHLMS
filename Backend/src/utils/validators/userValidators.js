import { z } from "zod";

export const createUserSchema = {
  body: z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters long"),
      email: z.string().email("Please provide a valid email address"),
      password: z.string().min(6, "Password must be at least 6 characters long"),
      role: z.enum(["student", "staff"], {
        errorMap: () => ({ message: "Role must be either 'student' or 'staff'" }),
      }),
      studentId: z.string().optional(),
      employeeId: z.string().optional(),
      phone: z.string().optional(),
      hostelId: z.number().int().positive().optional(),
      floorId: z.number().int().positive().optional(),
      roomId: z.number().int().positive().optional(),
      barcodeValue: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional().default("active"),
    })
    .superRefine((data, ctx) => {
      if (data.role === "student" && (!data.studentId || data.studentId.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Student ID is required when role is 'student'",
          path: ["studentId"],
        });
      }
      if (data.role === "staff" && (!data.employeeId || data.employeeId.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Employee ID is required when role is 'staff'",
          path: ["employeeId"],
        });
      }
    }),
};

export const updateUserSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters long").optional(),
    email: z.string().email("Please provide a valid email address").optional(),
    password: z.string().min(6, "Password must be at least 6 characters long").optional(),
    studentId: z.string().optional(),
    employeeId: z.string().optional(),
    phone: z.string().nullable().optional(),
    hostelId: z.number().int().positive().nullable().optional(),
    floorId: z.number().int().positive().nullable().optional(),
    roomId: z.number().int().positive().nullable().optional(),
    barcodeValue: z.string().optional(),
  }),
};

export const updateUserStatusSchema = {
  body: z.object({
    status: z.enum(["active", "inactive"], {
      errorMap: () => ({ message: "Status must be 'active' or 'inactive'" }),
    }),
  }),
};

export const getUsersQuerySchema = {
  query: z.object({
    role: z.enum(["student", "staff", "admin"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
