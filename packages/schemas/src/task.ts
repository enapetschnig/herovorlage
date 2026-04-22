import { z } from "zod";
import { listInput } from "./common";

export const taskCreateSchema = z.object({
  projectId: z.string().optional(),
  contactId: z.string().optional(),
  title: z.string().trim().min(1).max(240),
  description: z.string().max(4000).optional(),
  dueDate: z.string().date().optional(),
  assignedUserId: z.string().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).default("open"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = taskCreateSchema.partial().extend({ id: z.string() });

export const taskListInput = listInput({
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  projectId: z.string().optional(),
  assignedUserId: z.string().optional(),
});
