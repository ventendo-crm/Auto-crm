import { z } from "zod";

export const createManagerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export const createUserSchema = createManagerSchema.extend({
  role: z.enum(["ADMIN", "MANAGER", "VIEWER"]),
});

export const staffRoleSchema = z.enum(["ADMIN", "MANAGER", "VIEWER"]);