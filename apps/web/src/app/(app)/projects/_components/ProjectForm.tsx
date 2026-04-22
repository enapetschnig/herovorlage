"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectCreateSchema, type ProjectCreateInput } from "@heatflow/schemas";
import { Button, Card, CardContent, EntityCombobox, Field, FieldGroup, Input, Textarea } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { PROJECT_STATUSES } from "@heatflow/utils/constants";
import { QuickContactDialog } from "./QuickContactDialog";

type ContactOpt = { id: string; label: string; sub?: string };

export function ProjectForm({
  contacts: initialContacts, members, presetContactId, mode = "create", projectId, defaults,
}: {
  contacts: ContactOpt[];
  members: { id: string; name: string; role: string }[];
  presetContactId?: string;
  mode?: "create" | "edit";
  projectId?: string;
  defaults?: Partial<ProjectCreateInput>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [contacts, setContacts] = useState<ContactOpt[]>(initialContacts);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");

  const create = trpc.projects.create.useMutation();
  const update = trpc.projects.update.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      title: "",
      contactId: presetContactId ?? contacts[0]?.id ?? "",
      status: "lead",
      trade: "SHK",
      ...defaults,
    },
  });
  const { register, handleSubmit, control, formState, setValue } = form;

  const onSubmit = handleSubmit((values) => {
    setPending(true);
    if (mode === "edit" && projectId) {
      update.mutate({ id: projectId, ...values }, {
        onSuccess: () => { toast.success("Projekt aktualisiert"); router.push(`/projects/${projectId}`); router.refresh(); },
        onError: (e) => { toast.error(e.message); setPending(false); },
      });
    } else {
      create.mutate(values, {
        onSuccess: ({ id }) => { toast.success("Projekt angelegt"); router.push(`/projects/${id}`); router.refresh(); },
        onError: (e) => { toast.error(e.message); setPending(false); },
      });
    }
  });

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <Field label="Projekttitel" htmlFor="title" required error={formState.errors.title?.message}>
              <Input id="title" placeholder="z.B. Sole/Wasser-WP 12kW Steiner" {...register("title")} />
            </Field>

            <FieldGroup columns={2}>
              <Field label="Kunde" required error={formState.errors.contactId?.message}>
                <Controller
                  control={control}
                  name="contactId"
                  render={({ field }) => (
                    <EntityCombobox
                      value={field.value}
                      onChange={field.onChange}
                      options={contacts}
                      placeholder="Kunde auswählen…"
                      onCreateNew={(q) => { setQuickQuery(q); setQuickOpen(true); }}
                      newLabel="Neuen Kontakt anlegen"
                    />
                  )}
                />
              </Field>
              <Field label="Status" htmlFor="status">
                <select id="status" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("status")}>
                  {PROJECT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </Field>
              <Field label="Gewerk" htmlFor="trade">
                <select id="trade" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("trade")}>
                  <option value="SHK">SHK</option>
                  <option value="Elektro">Elektro</option>
                  <option value="Spengler">Spengler</option>
                  <option value="Sonstige">Sonstige</option>
                </select>
              </Field>
              <Field label="Verantwortlich" htmlFor="responsibleUserId">
                <select id="responsibleUserId" className="h-9 px-3 rounded-md border border-input bg-bg text-sm w-full" {...register("responsibleUserId")}>
                  <option value="">— niemand —</option>
                  {members.map((m) => (<option key={m.id} value={m.id}>{m.name} ({m.role})</option>))}
                </select>
              </Field>
              <Field label="Start" htmlFor="startDate">
                <Input id="startDate" type="date" {...register("startDate")} />
              </Field>
              <Field label="Ende" htmlFor="endDate">
                <Input id="endDate" type="date" {...register("endDate")} />
              </Field>
              <Field label="Potential (€)" htmlFor="potentialValue">
                <Input id="potentialValue" type="number" step="0.01" {...register("potentialValue", { valueAsNumber: true })} />
              </Field>
              <Field label="Quelle" htmlFor="source">
                <Input id="source" placeholder="z.B. Webformular" {...register("source")} />
              </Field>
            </FieldGroup>

            <Field label="Beschreibung" htmlFor="description">
              <Textarea id="description" rows={5} {...register("description")} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Abbrechen</Button>
          <Button type="submit" disabled={pending}>
            {pending ? <><Loader2 className="size-4 animate-spin" /> Speichern…</> : <><Save className="size-4" /> {mode === "edit" ? "Speichern" : "Projekt anlegen"}</>}
          </Button>
        </div>
      </form>

      <QuickContactDialog
        open={quickOpen}
        initialName={quickQuery}
        onClose={() => setQuickOpen(false)}
        onCreated={(c) => {
          // Add to local options list and select
          const opt: ContactOpt = { id: c.id, label: c.label, sub: c.sub };
          setContacts((prev) => [opt, ...prev.filter((o) => o.id !== c.id)]);
          setValue("contactId", c.id, { shouldValidate: true });
          setQuickOpen(false);
          // Refresh the contacts cache used by other consumers
          utils.contacts.list.invalidate();
        }}
      />
    </>
  );
}
