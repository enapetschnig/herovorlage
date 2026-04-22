import { z } from "zod";
import { listInput } from "./common";
import { PROJECT_STATUSES } from "@heatflow/utils/constants";

export const projectCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  contactId: z.string(),
  addressId: z.string().optional(),
  projectTypeId: z.string().optional(),
  trade: z.string().trim().max(60).optional(),
  status: z.enum(PROJECT_STATUSES).default("lead"),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  potentialValue: z.number().min(0).optional(),
  source: z.string().trim().max(60).optional(),
  responsibleUserId: z.string().optional(),
  reminderAt: z.string().datetime().optional(),
  description: z.string().max(8000).optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  id: z.string(),
});
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const projectListInput = listInput({
  status: z.enum(PROJECT_STATUSES).optional(),
  contactId: z.string().optional(),
  responsibleUserId: z.string().optional(),
  trade: z.string().optional(),
});
export type ProjectListInput = z.infer<typeof projectListInput>;

export const projectStatusChangeInput = z.object({
  id: z.string(),
  status: z.enum(PROJECT_STATUSES),
  comment: z.string().max(500).optional(),
});
