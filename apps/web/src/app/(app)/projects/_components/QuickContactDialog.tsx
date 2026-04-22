"use client";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button, Field, Input } from "@heatflow/ui";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

export function QuickContactDialog({
  open, initialName = "", onClose, onCreated,
}: {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (c: { id: string; label: string; sub: string }) => void;
}) {
  const [kind, setKind] = useState<"person" | "company">("person");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const create = trpc.contacts.create.useMutation();

  useEffect(() => {
    if (open) {
      // Heuristic: if the typed-in name has a space, assume "First Last".
      const parts = initialName.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        setKind("person");
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" "));
        setCompanyName("");
      } else if (parts.length === 1) {
        setKind("person");
        setFirstName("");
        setLastName(parts[0] ?? "");
        setCompanyName(parts[0] ?? "");
      }
    } else {
      setCompanyName(""); setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    }
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        type: "customer",
        kind,
        companyName: kind === "company" ? companyName : "",
        firstName: kind === "person" ? firstName : "",
        lastName: kind === "person" ? lastName : "",
        email: email || "",
        mobile: phone || "",
        addresses: [{ kind: "main", country: "AT" }],
        tagIds: [],
        paymentTermsDays: 14,
        discountPct: 0,
        skontoPct: 0,
        skontoDays: 0,
      },
      {
        onSuccess: ({ id, customerNumber }) => {
          const label = kind === "company" ? companyName : `${firstName} ${lastName}`.trim();
          toast.success(`Kontakt „${label}" angelegt`);
          onCreated({ id, label, sub: customerNumber });
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Kontakt schnell anlegen</h2>
          <button onClick={onClose} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg"><X className="size-4" /></button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setKind("person")} className={`flex-1 h-9 rounded border text-sm ${kind === "person" ? "bg-primary text-primary-fg border-primary" : "border-border bg-card"}`}>
              👤 Person
            </button>
            <button type="button" onClick={() => setKind("company")} className={`flex-1 h-9 rounded border text-sm ${kind === "company" ? "bg-primary text-primary-fg border-primary" : "border-border bg-card"}`}>
              🏢 Firma
            </button>
          </div>

          {kind === "person" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Vorname"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
              <Field label="Nachname"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus /></Field>
            </div>
          ) : (
            <Field label="Firmenname" required>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus required />
            </Field>
          )}

          <Field label="E-Mail (optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Mobil (optional)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>

          <p className="text-xs text-muted-fg">Mehr Felder kannst du später im Kontakt-Detail ergänzen.</p>

          <footer className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Anlegen
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
