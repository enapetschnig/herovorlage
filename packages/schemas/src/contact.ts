import { z } from "zod";
import { addressSchema, listInput } from "./common";

const phone = z.string().trim().max(40).optional().or(z.literal(""));
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const contactCreateSchema = z
  .object({
    type: z.enum(["customer", "supplier", "partner", "other"]).default("customer"),
    kind: z.enum(["person", "company"]).default("person"),
    salutation: optStr(20),
    title: optStr(40),
    firstName: optStr(80),
    lastName: optStr(80),
    companyName: optStr(160),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone,
    mobile: phone,
    fax: phone,
    website: optStr(200),
    birthday: z.string().date().optional().or(z.literal("")),
    category: optStr(60),
    source: optStr(60),
    paymentTermsDays: z.number().int().min(0).max(365).default(14),
    discountPct: z.number().min(0).max(100).default(0),
    skontoPct: z.number().min(0).max(100).default(0),
    skontoDays: z.number().int().min(0).max(180).default(0),
    iban: optStr(34),
    bic: optStr(20),
    bankName: optStr(120),
    vatId: optStr(40),
    leitwegId: optStr(60),
    debitorAccount: optStr(20),
    creditorAccount: optStr(20),
    notes: z.string().max(4000).optional().or(z.literal("")),
    addresses: z.array(addressSchema).default([]),
    tagIds: z.array(z.string()).default([]),
  })
  .refine(
    (v) =>
      (v.kind === "company" && !!v.companyName) || (v.kind === "person" && (!!v.firstName || !!v.lastName)),
    { message: "Firmenname oder Vor-/Nachname erforderlich" },
  );
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export const contactUpdateSchema = contactCreateSchema.innerType().partial().extend({
  id: z.string(),
});
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export const contactListInput = listInput({
  type: z.enum(["customer", "supplier", "partner", "other"]).optional(),
  kind: z.enum(["person", "company"]).optional(),
  tagId: z.string().optional(),
});
export type ContactListInput = z.infer<typeof contactListInput>;
