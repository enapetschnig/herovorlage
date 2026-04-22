import { z } from "zod";
import { listInput } from "./common";

export const articleCreateSchema = z.object({
  number: z.string().trim().max(80).optional(),
  ean: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(300),
  shortText: z.string().max(500).optional(),
  longText: z.string().max(8000).optional(),
  unit: z.string().trim().max(20).default("Stk"),
  purchasePrice: z.number().min(0).default(0),
  listPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  vatPct: z.number().min(0).max(50).default(20),
  manufacturer: z.string().max(120).optional(),
  manufacturerNumber: z.string().max(120).optional(),
  groupId: z.string().optional(),
  supplierId: z.string().optional(),
  stock: z.number().default(0),
  imageUrl: z.string().url().optional(),
});
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

export const articleListInput = listInput({
  groupId: z.string().optional(),
  supplierId: z.string().optional(),
});
