import { z } from "zod";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, POSITION_KINDS } from "@heatflow/utils/constants";
import { listInput } from "./common";

export const documentPositionInput = z.object({
  id: z.string().optional(),
  parentPositionId: z.string().optional(),
  orderNum: z.number().int().min(0),
  kind: z.enum(POSITION_KINDS).default("article"),
  articleId: z.string().optional(),
  serviceId: z.string().optional(),
  positionNumber: z.string().max(40).optional(),
  description: z.string().max(8000).default(""),
  quantity: z.number().default(1),
  unit: z.string().max(20).default("Stk"),
  unitPrice: z.number().default(0),
  discountPct: z.number().min(0).max(100).default(0),
  vatPct: z.number().min(0).max(50).default(20),
});
export type DocumentPositionInput = z.infer<typeof documentPositionInput>;

export const documentCreateSchema = z.object({
  type: z.enum(DOCUMENT_TYPES).default("quote"),
  projectId: z.string().optional(),
  contactId: z.string(),
  addressId: z.string().optional(),
  title: z.string().trim().max(200).optional(),
  documentDate: z.string().date(),
  dueDate: z.string().date().optional(),
  status: z.enum(DOCUMENT_STATUSES).default("draft"),
  currency: z.enum(["EUR", "CHF"]).default("EUR"),
  introText: z.string().max(8000).optional(),
  closingText: z.string().max(8000).optional(),
  positions: z.array(documentPositionInput).default([]),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

export const documentUpdateSchema = documentCreateSchema.partial().extend({
  id: z.string(),
});
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

export const documentListInput = listInput({
  type: z.enum(DOCUMENT_TYPES).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  contactId: z.string().optional(),
  projectId: z.string().optional(),
});
export type DocumentListInput = z.infer<typeof documentListInput>;
