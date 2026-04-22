import { notFound } from "next/navigation";
import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { ContactForm } from "../../_components/ContactForm";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getTrpcCaller();
  let c;
  try { c = await trpc.contacts.byId({ id }); } catch { notFound(); }

  const displayName =
    c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Kontakt";

  return (
    <>
      <PageHeader title={`${displayName} bearbeiten`} description={c.customerNumber ?? ""} />
      <div className="p-6 max-w-4xl mx-auto">
        <ContactForm
          mode="edit"
          contactId={c.id}
          defaults={{
            type: c.type as "customer" | "supplier" | "partner" | "other",
            kind: c.kind as "person" | "company",
            salutation: c.salutation ?? "",
            title: c.title ?? "",
            firstName: c.firstName ?? "",
            lastName: c.lastName ?? "",
            companyName: c.companyName ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
            mobile: c.mobile ?? "",
            fax: c.fax ?? "",
            website: c.website ?? "",
            birthday: c.birthday ?? "",
            category: c.category ?? "",
            source: c.source ?? "",
            paymentTermsDays: c.paymentTermsDays ?? 14,
            discountPct: Number(c.discountPct ?? 0),
            skontoPct: Number(c.skontoPct ?? 0),
            skontoDays: c.skontoDays ?? 0,
            iban: c.iban ?? "",
            bic: c.bic ?? "",
            bankName: c.bankName ?? "",
            vatId: c.vatId ?? "",
            leitwegId: c.leitwegId ?? "",
            debitorAccount: c.debitorAccount ?? "",
            creditorAccount: c.creditorAccount ?? "",
            notes: c.notes ?? "",
            addresses: c.addresses.length > 0 ? c.addresses.map((a) => ({
              kind: a.kind as "main" | "billing" | "shipping" | "site",
              street: a.street ?? "",
              zip: a.zip ?? "",
              city: a.city ?? "",
              country: a.country ?? "AT",
            })) : [{ kind: "main", country: "AT" }],
            tagIds: c.tags.map((t) => t.id),
          }}
        />
      </div>
    </>
  );
}
