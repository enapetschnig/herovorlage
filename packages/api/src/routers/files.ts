import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { STORAGE_BUCKETS, type StorageBucket, buildStoragePath } from "@heatflow/utils/storage";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENTITY_KIND = z.enum(["project", "contact", "document"]);
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME = /^(image\/.*|application\/(pdf|zip|json)|text\/.*|video\/.*)$/i;

let cachedAdmin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}

function bucketFor(entityType: z.infer<typeof ENTITY_KIND>): StorageBucket {
  if (entityType === "project") return STORAGE_BUCKETS.PROJECT_FILES;
  if (entityType === "contact") return STORAGE_BUCKETS.CONTACT_FILES;
  return STORAGE_BUCKETS.DOCUMENTS;
}

export const filesRouter = router({
  /** List files attached to a contact, project, or document. */
  list: protectedProcedure
    .input(z.object({ entityType: ENTITY_KIND, entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const f = schema.files;
      const where =
        input.entityType === "project"
          ? eq(f.projectId, input.entityId)
          : input.entityType === "contact"
            ? eq(f.contactId, input.entityId)
            : eq(f.id, "__never__"); // document files come via documents.byId
      return ctx.db
        .select()
        .from(f)
        .where(and(eq(f.tenantId, ctx.tenantId), isNull(f.deletedAt), where))
        .orderBy(desc(f.createdAt));
    }),

  /**
   * Issues a Supabase Storage signed-upload URL the client uploads to directly.
   * Path scheme: `{tenantId}/{entityKind}/{entityId}/{ts}_{filename}`
   * After the upload completes, client calls `confirmUpload` with the storage_key.
   */
  createUploadUrl: protectedProcedure
    .input(
      z.object({
        entityType: ENTITY_KIND,
        entityId: z.string(),
        filename: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        sizeBytes: z.number().int().positive().max(MAX_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_MIME.test(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Dateityp ${input.mimeType} nicht erlaubt.` });
      }
      const bucket = bucketFor(input.entityType);
      const path = buildStoragePath(ctx.tenantId, input.entityType, input.entityId, input.filename);

      const { data, error } = await admin().storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return { bucket, path, token: data.token, signedUrl: data.signedUrl };
    }),

  /** Persists the file metadata after the client successfully uploaded to the signed URL. */
  confirmUpload: protectedProcedure
    .input(
      z.object({
        entityType: ENTITY_KIND,
        entityId: z.string(),
        bucket: z.string(),
        storageKey: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        label: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = idFor.file();
      await ctx.db.insert(schema.files).values({
        id,
        tenantId: ctx.tenantId,
        projectId: input.entityType === "project" ? input.entityId : null,
        contactId: input.entityType === "contact" ? input.entityId : null,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.sizeBytes,
        storageBucket: input.bucket,
        storageKey: input.storageKey,
        uploadedByUserId: ctx.userId,
        label: input.label ?? null,
      });

      // Logbook
      await ctx.db.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind: "system",
        message: `Datei „${input.filename}" hochgeladen.`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { id };
    }),

  /** Returns a short-lived signed URL for download. */
  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [file] = await ctx.db
        .select({ bucket: schema.files.storageBucket, key: schema.files.storageKey })
        .from(schema.files)
        .where(and(eq(schema.files.id, input.id), eq(schema.files.tenantId, ctx.tenantId), isNull(schema.files.deletedAt)))
        .limit(1);
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      const { data, error } = await admin().storage.from(file.bucket).createSignedUrl(file.key, 3600);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { url: data.signedUrl };
    }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [file] = await ctx.db
      .select({ bucket: schema.files.storageBucket, key: schema.files.storageKey })
      .from(schema.files)
      .where(and(eq(schema.files.id, input.id), eq(schema.files.tenantId, ctx.tenantId)))
      .limit(1);
    if (!file) throw new TRPCError({ code: "NOT_FOUND" });

    // Soft-delete metadata. Hard-delete the storage object: we don't keep orphans.
    await admin().storage.from(file.bucket).remove([file.key]).catch(() => {});
    await ctx.db
      .update(schema.files)
      .set({ deletedAt: new Date() })
      .where(eq(schema.files.id, input.id));
    return { id: input.id };
  }),
});
