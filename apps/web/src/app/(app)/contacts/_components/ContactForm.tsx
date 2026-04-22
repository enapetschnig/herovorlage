"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactCreateSchema, type ContactCreateInput } from "@heatflow/schemas";
import { Button, Card, CardContent, Field, FieldGroup, Input, Tabs, Textarea } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export function ContactForm({
  mode = "create", contactId, defaults,
}: {
  mode?: "create" | "edit";
  contactId?: string;
  defaults?: Partial<ContactCreateInput>;
} = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<ContactCreateInput>({
    resolver: zodResolver(contactCreateSchema),
    defaultValues: {
      type: "customer",
      kind: "person",
      paymentTermsDays: 14,
      discountPct: 0,
      skontoPct: 0,
      skontoDays: 0,
      addresses: [{ kind: "main", country: "AT" }],
      tagIds: [],
      email: "", phone: "", mobile: "", fax: "", website: "",
      firstName: "", lastName: "", companyName: "", salutation: "", title: "",
      iban: "", bic: "", bankName: "", vatId: "", leitwegId: "",
      debitorAccount: "", creditorAccount: "", category: "", source: "", birthday: "",
      notes: "",
      ...defaults,
    },
  });
  const { register, handleSubmit, watch, formState } = form;
  const kind = watch("kind");

  const create = trpc.contacts.create.useMutation();
  const update = trpc.contacts.update.useMutation();

  const onSubmit = handleSubmit((values) => {
    setPending(true);
    if (mode === "edit" && contactId) {
      update.mutate(
        { id: contactId, ...values },
        {
          onSuccess: () => { toast.success("Kontakt aktualisiert"); router.push(`/contacts/${contactId}`); router.refresh(); },
          onError: (e) => { toast.error(e.message); setPending(false); },
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: ({ id }) => { toast.success("Kontakt angelegt"); router.push(`/contacts/${id}`); router.refresh(); },
        onError: (e) => { toast.error(e.message); setPending(false); },
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <FieldGroup columns={2}>
            <Field label="Typ" htmlFor="type">
              <select id="type" className="h-9 px-3 rounded-md border border-input bg-bg text-sm" {...register("type")}>
                <option value="customer">Kunde</option>
                <option value="supplier">Lieferant</option>
                <option value="partner">Partner</option>
                <option value="other">Sonstige</option>
              </select>
            </Field>
            <Field label="Person / Firma" htmlFor="kind">
              <select id="kind" className="h-9 px-3 rounded-md border border-input bg-bg text-sm" {...register("kind")}>
                <option value="person">Person</option>
                <option value="company">Firma</option>
              </select>
            </Field>
          </FieldGroup>

          {kind === "person" ? (
            <FieldGroup columns={3}>
              <Field label="Anrede" htmlFor="salutation">
                <Input id="salutation" {...register("salutation")} />
              </Field>
              <Field label="Vorname" htmlFor="firstName" error={formState.errors.firstName?.message}>
                <Input id="firstName" {...register("firstName")} />
              </Field>
              <Field label="Nachname" htmlFor="lastName">
                <Input id="lastName" {...register("lastName")} />
              </Field>
            </FieldGroup>
          ) : (
            <Field label="Firmenname" htmlFor="companyName" required>
              <Input id="companyName" {...register("companyName")} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Tabs
        items={[
          {
            id: "contact", label: "Kontaktdetails",
            content: (
              <FieldGroup columns={2}>
                <Field label="E-Mail" htmlFor="email" error={formState.errors.email?.message}>
                  <Input id="email" type="email" {...register("email")} />
                </Field>
                <Field label="Quelle" htmlFor="source">
                  <Input id="source" placeholder="z.B. Webformular, Empfehlung" {...register("source")} />
                </Field>
                <Field label="Festnetz" htmlFor="phone">
                  <Input id="phone" {...register("phone")} />
                </Field>
                <Field label="Mobil" htmlFor="mobile">
                  <Input id="mobile" {...register("mobile")} />
                </Field>
                <Field label="Fax" htmlFor="fax">
                  <Input id="fax" {...register("fax")} />
                </Field>
                <Field label="Website" htmlFor="website">
                  <Input id="website" placeholder="https://" {...register("website")} />
                </Field>
                <Field label="Geburtsdatum" htmlFor="birthday">
                  <Input id="birthday" type="date" {...register("birthday")} />
                </Field>
                <Field label="Kategorie" htmlFor="category">
                  <Input id="category" {...register("category")} />
                </Field>
              </FieldGroup>
            ),
          },
          {
            id: "address", label: "Adresse",
            content: (
              <FieldGroup columns={2}>
                <Field label="Straße + Hausnr." htmlFor="addresses.0.street" className="sm:col-span-2">
                  <Input id="addresses.0.street" {...register("addresses.0.street")} />
                </Field>
                <Field label="PLZ" htmlFor="addresses.0.zip">
                  <Input id="addresses.0.zip" {...register("addresses.0.zip")} />
                </Field>
                <Field label="Ort" htmlFor="addresses.0.city">
                  <Input id="addresses.0.city" {...register("addresses.0.city")} />
                </Field>
                <Field label="Land" htmlFor="addresses.0.country">
                  <select id="addresses.0.country" className="h-9 px-3 rounded-md border border-input bg-bg text-sm" {...register("addresses.0.country")}>
                    <option value="AT">Österreich</option>
                    <option value="DE">Deutschland</option>
                    <option value="CH">Schweiz</option>
                    <option value="IT">Italien</option>
                  </select>
                </Field>
              </FieldGroup>
            ),
          },
          {
            id: "conditions", label: "Konditionen",
            content: (
              <FieldGroup columns={2}>
                <Field label="Zahlungsziel (Tage)" htmlFor="paymentTermsDays">
                  <Input id="paymentTermsDays" type="number" {...register("paymentTermsDays", { valueAsNumber: true })} />
                </Field>
                <Field label="Rabatt %" htmlFor="discountPct">
                  <Input id="discountPct" type="number" step="0.01" {...register("discountPct", { valueAsNumber: true })} />
                </Field>
                <Field label="Skonto %" htmlFor="skontoPct">
                  <Input id="skontoPct" type="number" step="0.01" {...register("skontoPct", { valueAsNumber: true })} />
                </Field>
                <Field label="Skonto-Ziel (Tage)" htmlFor="skontoDays">
                  <Input id="skontoDays" type="number" {...register("skontoDays", { valueAsNumber: true })} />
                </Field>
              </FieldGroup>
            ),
          },
          {
            id: "bank", label: "Zahlungsdaten",
            content: (
              <FieldGroup columns={2}>
                <Field label="IBAN" htmlFor="iban" className="sm:col-span-2">
                  <Input id="iban" className="font-mono" {...register("iban")} />
                </Field>
                <Field label="BIC" htmlFor="bic">
                  <Input id="bic" className="font-mono" {...register("bic")} />
                </Field>
                <Field label="Bank" htmlFor="bankName">
                  <Input id="bankName" {...register("bankName")} />
                </Field>
                <Field label="UID/UStId" htmlFor="vatId">
                  <Input id="vatId" {...register("vatId")} />
                </Field>
                <Field label="Debitor-Konto" htmlFor="debitorAccount">
                  <Input id="debitorAccount" {...register("debitorAccount")} />
                </Field>
                <Field label="Kreditor-Konto" htmlFor="creditorAccount">
                  <Input id="creditorAccount" {...register("creditorAccount")} />
                </Field>
              </FieldGroup>
            ),
          },
          {
            id: "einvoice", label: "ZUGFeRD/E-Rechnung",
            content: (
              <Field label="Leitweg-ID" hint="Pflicht für XRechnung an öffentliche Auftraggeber" htmlFor="leitwegId">
                <Input id="leitwegId" className="font-mono" {...register("leitwegId")} />
              </Field>
            ),
          },
          {
            id: "notes", label: "Notizen",
            content: (
              <Field label="Notizen" htmlFor="notes">
                <Textarea id="notes" rows={6} {...register("notes")} />
              </Field>
            ),
          },
        ]}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Abbrechen</Button>
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Speichern…</> : <><Save className="size-4" /> {mode === "edit" ? "Speichern" : "Kontakt anlegen"}</>}
        </Button>
      </div>
    </form>
  );
}
