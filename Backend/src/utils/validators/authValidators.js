import { z } from "zod";

export const loginSchema = {
  body: z.object({
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(1, "Password is required"),
  }),
};
