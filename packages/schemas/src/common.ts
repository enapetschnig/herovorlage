import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const tenantIdSchema = idSchema;

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(200).default(50),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const sortDirectionSchema = z.enum(["asc", "desc"]);

export function listInput<T extends z.ZodRawShape>(extra: T) {
  return paginationSchema.extend({
    search: z.string().trim().min(1).optional(),
    sortBy: z.string().optional(),
    sortDir: sortDirectionSchema.default("desc"),
    ...extra,
  });
}

export const addressSchema = z.object({
  kind: z.enum(["billing", "shipping", "site", "main"]).default("main"),
  street: z.string().trim().max(200).optional(),
  zip: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().length(2).default("AT"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;
