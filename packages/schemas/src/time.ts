import { z } from "zod";
import { listInput } from "./common";

export const timeEntryCreateSchema = z
  .object({
    userId: z.string().optional(),
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    activityType: z.string().max(60).default("work"),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    breakMinutes: z.number().int().min(0).max(720).default(0),
    billable: z.boolean().default(true),
    comment: z.string().max(1000).optional(),
  })
  .refine((v) => !v.endedAt || new Date(v.endedAt) > new Date(v.startedAt), {
    message: "Ende muss nach Start liegen",
  });
export type TimeEntryCreateInput = z.infer<typeof timeEntryCreateSchema>;

export const timeEntryUpdateSchema = timeEntryCreateSchema.innerType().partial().extend({
  id: z.string(),
});

export const timeListInput = listInput({
  userId: z.string().optional(),
  projectId: z.string().optional(),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
});
