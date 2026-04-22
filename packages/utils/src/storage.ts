/**
 * Thin wrapper around Supabase Storage. Encapsulated here so a future swap
 * to direct S3 / MinIO is one-file change (see ADR-0001).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) required");
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export const STORAGE_BUCKETS = {
  CONTACT_FILES: "contact-files",
  PROJECT_FILES: "project-files",
  DOCUMENTS: "documents",
  AVATARS: "avatars",
} as const;
export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  body: Blob | ArrayBuffer | Uint8Array | File,
  opts: { contentType?: string; upsert?: boolean } = {},
): Promise<{ path: string }> {
  const { error, data } = await client()
    .storage.from(bucket)
    .upload(path, body, { contentType: opts.contentType, upsert: opts.upsert ?? false });
  if (error) throw error;
  return { path: data.path };
}

export async function signedUrl(bucket: StorageBucket, path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await client().storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  const { error } = await client().storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function buildStoragePath(tenantId: string, entityKind: string, entityId: string, filename: string): string {
  const ts = Date.now();
  const safe = filename.replace(/[^\w.\-]/g, "_");
  return `${tenantId}/${entityKind}/${entityId}/${ts}_${safe}`;
}
