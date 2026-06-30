import { z } from "zod";

export const createReminderSchema = z.object({
  title: z.string().min(1, "Укажите текст").max(300),
  dueDate: z.string().min(1),
});

export const updateReminderSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  dueDate: z.string().min(1).optional(),
  completed: z.boolean().optional(),
});
