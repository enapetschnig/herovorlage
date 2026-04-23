"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { documentCreateSchema, type DocumentCreateInput } from "@heatflow/schemas";
import { Button, Card, CardContent, Field, FieldGroup, Input, Textarea } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { formatMoney, lineNet, round2 } from "@heatflow/utils";
import { POSITION_KINDS, DOCUMENT_TYPES } from "@heatflow/utils/constants";

const TYPE_LABEL: Record<string, string> = {
  quote: "Angebot",
  order_confirmation: "Auftragsbestätigung",
  delivery_note: "Lieferschein",
  invoice: "Rechnung",
  partial_invoice: "Teilrechnung",
  final_invoice: "Schlussrechnung",
  credit_note: "Gutschrift",
};

export function DocumentForm({
  contacts,
  projects,
  presetContactId,
  presetProjectId,
  presetType,
}: {
  contacts: { id: string; label: string }[];
  projects: { id: string; label: string; contactId: string }[];
  presetContactId?: string;
  presetProjectId?: string;
  presetType?: "quote" | "invoice";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const create = trpc.documents.create.useMutation();

  // If preset project, derive its contact
  const resolvedContactId = presetContactId ??
    (presetProjectId ? projects.find((p) => p.id === presetProjectId)?.contactId : undefined) ??
    contacts[0]?.id;

  const form = useForm<DocumentCreateInput>({
    resolver: zodResolver(documentCreateSchema),
    defaultValues: {
      type: presetType ?? "quote",
      contactId: resolvedContactId,
      projectId: presetProjectId,
      title: "",
      documentDate: new Date().toISOString().slice(0, 10),
      dueDate: addDays(new Date(), 30).toISOString().slice(0, 10),
      status: "draft",
      currency: "EUR",
      introText: "",
      closingText: "",
      positions: [
        { kind: "title", description: "Leistungsbeschreibung", orderNum: 1, quantity: 0, unit: "", unitPrice: 0, discountPct: 0, vatPct: 20 },
        { kind: "article", description: "", orderNum: 2, quantity: 1, unit: "Stk", unitPrice: 0, discountPct: 0, vatPct: 20 },
      ],
    },
  });
  const { register, control, handleSubmit, watch, setValue, reset, formState } = form;
  const { fields, append, remove, move, update } = useFieldArray({ control, name: "positions" });
  const positions = watch("positions");

  // Pick up FlowAI prefill from sessionStorage (set by PhotoToOffer "Angebot erstellen" button)
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || typeof window === "undefined") return;
    const raw = sessionStorage.getItem("heatflow.prefillDocument");
    if (!raw) return;
    prefillApplied.current = true;
    sessionStorage.removeItem("heatflow.prefillDocument");
    try {
      const p = JSON.parse(raw) as {
        title?: string;
        introText?: string;
        closingText?: string;
        positions?: Array<{ kind: string; description: string; quantity: number; unit: string; unitPrice: number; vatPct: number }>;
      };
      const current = form.getValues();
      reset({
        ...current,
        title: p.title ?? current.title,
        introText: p.introText ?? current.introText,
        closingText: p.closingText ?? current.closingText,
        positions: (p.positions ?? current.positions).map((pos, i) => ({
          kind: pos.kind as "article" | "service" | "text" | "title" | "subtotal",
          description: pos.description,
          quantity: pos.quantity ?? 1,
          unit: pos.unit ?? "Stk",
          unitPrice: pos.unitPrice ?? 0,
          discountPct: 0,
          vatPct: pos.vatPct ?? 20,
          orderNum: i + 1,
        })),
      });
    } catch {
      // malformed prefill — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live totals
  const totals = useMemo(() => {
    let net = 0; let vat = 0;
    for (const p of positions ?? []) {
      if (p.kind !== "article" && p.kind !== "service") continue;
      const ln = lineNet(p.quantity, p.unitPrice, p.discountPct);
      net += ln;
      vat += round2(ln * (p.vatPct / 100));
    }
    return { net: round2(net), vat: round2(vat), gross: round2(net + vat) };
  }, [positions]);

  const onSubmit = handleSubmit((values) => {
    setPending(true);
    create.mutate(values, {
      onSuccess: ({ id, number }) => {
        toast.success(`${TYPE_LABEL[values.type]} ${number} angelegt`);
        router.push(`/documents/${id}?created=1`);
        router.refresh();
      },
      onError: (e) => { toast.error(e.message); setPending(false); },
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <FieldGroup columns={3}>
            <Field label="Typ" htmlFor="type">
              <select id="type" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("type")}>
                {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Datum" htmlFor="documentDate">
              <Input id="documentDate" type="date" {...register("documentDate")} />
            </Field>
            <Field label="Fällig am" htmlFor="dueDate">
              <Input id="dueDate" type="date" {...register("dueDate")} />
            </Field>
            <Field label="Kunde" htmlFor="contactId" required>
              <select id="contactId" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("contactId")}>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Projekt (optional)" htmlFor="projectId">
              <select id="projectId" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("projectId")}>
                <option value="">— kein Projekt —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Währung" htmlFor="currency">
              <select id="currency" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("currency")}>
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
              </select>
            </Field>
          </FieldGroup>

          <Field label="Titel (optional)" htmlFor="title">
            <Input id="title" placeholder="z.B. Wärmepumpen-Anlage Steiner" {...register("title")} />
          </Field>

          <Field label="Einleitungstext" htmlFor="introText">
            <Textarea id="introText" rows={3} placeholder="Sehr geehrte/r …" {...register("introText")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Positionen ({fields.length})</h3>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => append({ kind: "title", description: "Neue Sektion", orderNum: fields.length + 1, quantity: 0, unit: "", unitPrice: 0, discountPct: 0, vatPct: 20 })}>
                + Titel
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => append({ kind: "text", description: "Hinweistext", orderNum: fields.length + 1, quantity: 0, unit: "", unitPrice: 0, discountPct: 0, vatPct: 0 })}>
                + Text
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => append({ kind: "article", description: "", orderNum: fields.length + 1, quantity: 1, unit: "Stk", unitPrice: 0, discountPct: 0, vatPct: 20 })}>
                <Plus className="size-3.5" /> Position
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-fg text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-2 w-[40px]">#</th>
                  <th className="text-left p-2 w-[80px]">Typ</th>
                  <th className="text-left p-2">Bezeichnung</th>
                  <th className="text-right p-2 w-[80px]">Menge</th>
                  <th className="text-left p-2 w-[60px]">Einh.</th>
                  <th className="text-right p-2 w-[100px]">EP</th>
                  <th className="text-right p-2 w-[60px]">USt %</th>
                  <th className="text-right p-2 w-[100px]">Gesamt</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, idx) => (
                  <PositionRow
                    key={f.id}
                    idx={idx}
                    register={register}
                    onPickArticle={(article) => {
                      update(idx, {
                        ...positions[idx]!,
                        kind: "article",
                        articleId: article.id,
                        description: article.name,
                        unit: article.unit,
                        unitPrice: Number(article.salePrice),
                        vatPct: Number(article.vatPct),
                      });
                    }}
                    onMoveUp={() => idx > 0 && move(idx, idx - 1)}
                    onMoveDown={() => idx < fields.length - 1 && move(idx, idx + 1)}
                    onRemove={() => remove(idx)}
                    position={positions[idx]}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1 text-sm bg-muted/30 p-4 rounded">
              <div className="flex justify-between"><span className="text-muted-fg">Netto</span><span className="tabular-nums">{formatMoney(totals.net)}</span></div>
              <div className="flex justify-between"><span className="text-muted-fg">USt.</span><span className="tabular-nums">{formatMoney(totals.vat)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Brutto</span><span className="tabular-nums">{formatMoney(totals.gross)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Field label="Schlusstext" htmlFor="closingText">
            <Textarea id="closingText" rows={3} placeholder="Mit freundlichen Grüßen …" {...register("closingText")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Abbrechen</Button>
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Speichern…</> : <><Save className="size-4" /> Anlegen</>}
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------

function PositionRow({
  idx, register, position, onPickArticle, onMoveUp, onMoveDown, onRemove,
}: {
  idx: number;
  register: ReturnType<typeof useForm<DocumentCreateInput>>["register"];
  position: DocumentCreateInput["positions"][number] | undefined;
  onPickArticle: (a: { id: string; name: string; unit: string; salePrice: string; vatPct: string }) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const isData = position?.kind === "article" || position?.kind === "service";
  const total = isData ? lineNet(position?.quantity ?? 0, position?.unitPrice ?? 0, position?.discountPct ?? 0) : 0;

  return (
    <tr className="border-t border-border align-top">
      <td className="p-2 text-muted-fg text-xs">{idx + 1}</td>
      <td className="p-2">
        <select
          {...register(`positions.${idx}.kind` as const)}
          className="h-8 text-xs px-2 rounded border border-input bg-bg w-full"
        >
          {POSITION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </td>
      <td className="p-2 space-y-1">
        <Textarea {...register(`positions.${idx}.description` as const)} rows={isData ? 1 : 2} className="text-sm min-h-0" />
        {position?.kind === "article" && <ArticlePicker onPick={onPickArticle} />}
      </td>
      <td className="p-2">
        {isData && (
          <input type="number" step="0.001" {...register(`positions.${idx}.quantity` as const, { valueAsNumber: true })} className="h-8 text-sm px-2 rounded border border-input bg-bg w-full text-right tabular-nums" />
        )}
      </td>
      <td className="p-2">
        {isData && (
          <input {...register(`positions.${idx}.unit` as const)} className="h-8 text-sm px-2 rounded border border-input bg-bg w-full" />
        )}
      </td>
      <td className="p-2">
        {isData && (
          <input type="number" step="0.01" {...register(`positions.${idx}.unitPrice` as const, { valueAsNumber: true })} className="h-8 text-sm px-2 rounded border border-input bg-bg w-full text-right tabular-nums" />
        )}
      </td>
      <td className="p-2">
        {isData && (
          <input type="number" step="0.01" {...register(`positions.${idx}.vatPct` as const, { valueAsNumber: true })} className="h-8 text-sm px-2 rounded border border-input bg-bg w-full text-right tabular-nums" />
        )}
      </td>
      <td className="p-2 text-right tabular-nums font-medium">
        {isData ? formatMoney(total) : <span className="text-muted-fg">—</span>}
      </td>
      <td className="p-2">
        <div className="flex gap-0.5 justify-end">
          <button type="button" onClick={onMoveUp} className="p-1 rounded hover:bg-muted text-muted-fg" aria-label="hoch"><ArrowUp className="size-3.5" /></button>
          <button type="button" onClick={onMoveDown} className="p-1 rounded hover:bg-muted text-muted-fg" aria-label="runter"><ArrowDown className="size-3.5" /></button>
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-danger/10 text-danger" aria-label="löschen"><Trash2 className="size-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

function ArticlePicker({ onPick }: { onPick: (a: { id: string; name: string; unit: string; salePrice: string; vatPct: string }) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const search = trpc.articles.searchQuick.useQuery({ q: q || "x", limit: 8 }, { enabled: open && q.length >= 2 });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        <Search className="size-3" /> Artikel aus Stamm wählen
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-80 bg-card border border-border rounded shadow-lg p-2">
          <Input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Suche…" className="h-8 text-sm"
          />
          <ul className="mt-2 max-h-60 overflow-y-auto">
            {(search.data ?? []).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => { onPick({ id: a.id, name: a.name, unit: a.unit ?? "Stk", salePrice: String(a.salePrice), vatPct: String(a.vatPct) }); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 hover:bg-muted rounded text-sm"
                >
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-fg">{a.number} · {formatMoney(Number(a.salePrice))}</div>
                </button>
              </li>
            ))}
            {q.length >= 2 && (search.data?.length ?? 0) === 0 && !search.isLoading && (
              <li className="text-xs text-muted-fg px-2 py-2">Keine Treffer.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
