"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@heatflow/ui";
import { toast } from "sonner";
import { File as FileIcon, FileImage, FileText, Loader2, Trash2, Upload } from "lucide-react";

type FileItem = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageBucket: string;
  storageKey: string;
  createdAt: Date | string;
};

export function FileUpload({
  entityType, entityId, files,
}: {
  entityType: "project" | "contact";
  entityId: string;
  files: FileItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const createUrl = trpc.files.createUploadUrl.useMutation();
  const confirmUpload = trpc.files.confirmUpload.useMutation();
  const getDl = trpc.files.getDownloadUrl.useMutation();
  const remove = trpc.files.remove.useMutation();

  const upload = useCallback(async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error(`${file.name}: max. 50 MB.`);
      return;
    }
    setBusy(`upload:${file.name}`);
    try {
      const { signedUrl, bucket, path, token } = await createUrl.mutateAsync({
        entityType, entityId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      // Direct PUT to Supabase Storage signed URL
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false",
          authorization: `Bearer ${token}`,
        },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload fehlgeschlagen (${putRes.status})`);

      await confirmUpload.mutateAsync({
        entityType, entityId, bucket,
        storageKey: path,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      toast.success(`${file.name} hochgeladen`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }, [createUrl, confirmUpload, entityType, entityId, router]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => upload(f));
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => upload(f));
    e.target.value = "";
  };

  const download = async (id: string) => {
    setBusy(`dl:${id}`);
    try {
      const { url } = await getDl.mutateAsync({ id });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  const del = async (id: string, name: string) => {
    if (!window.confirm(`„${name}" wirklich löschen?`)) return;
    setBusy(`del:${id}`);
    try {
      await remove.mutateAsync({ id });
      toast.success("Gelöscht");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
        }`}
      >
        <Upload className="size-6 text-muted-fg mx-auto mb-2" />
        <p className="text-sm">Dateien hier ablegen, oder</p>
        <Button
          type="button" variant="secondary" size="sm" className="mt-2"
          onClick={() => inputRef.current?.click()}
        >
          Auswählen
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
        <p className="text-xs text-muted-fg mt-2">PDF, Bilder, Text — max. 50 MB</p>
      </div>

      {files.length > 0 && (
        <ul className="border border-border rounded-lg divide-y divide-border bg-card">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <FileTypeIcon mime={f.mimeType} />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => download(f.id)}
                  className="text-sm font-medium hover:underline text-left truncate block"
                >
                  {f.filename}
                </button>
                <div className="text-xs text-muted-fg">
                  {humanSize(f.size)} · {f.mimeType}
                </div>
              </div>
              <button
                type="button"
                onClick={() => del(f.id, f.filename)}
                disabled={busy?.startsWith("del")}
                className="p-2 rounded hover:bg-danger/10 text-danger"
                aria-label="Löschen"
              >
                {busy === `del:${f.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy?.startsWith("upload:") && (
        <div className="text-xs text-muted-fg flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Lade hoch…
        </div>
      )}
    </div>
  );
}

function FileTypeIcon({ mime }: { mime: string }) {
  const cls = "size-5 text-muted-fg flex-shrink-0";
  if (mime.startsWith("image/")) return <FileImage className={cls} />;
  if (mime.startsWith("text/") || mime === "application/pdf") return <FileText className={cls} />;
  return <FileIcon className={cls} />;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
