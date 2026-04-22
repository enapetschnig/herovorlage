import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, StatusBadge } from "@heatflow/ui";
import { formatMoney } from "@heatflow/utils";
import { Mail, Phone, MapPin, Briefcase, Pencil } from "lucide-react";
import { ContactAssetsCard } from "../_components/ContactAssetsCard";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getTrpcCaller();
  let contact;
  try {
    contact = await trpc.contacts.byId({ id });
  } catch {
    notFound();
  }

  const displayName =
    contact.companyName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "(unbenannt)";

  const typeLabel: Record<string, string> = {
    customer: "Kunde", supplier: "Lieferant", partner: "Partner", other: "Sonstige",
  };

  return (
    <>
      <PageHeader
        title={displayName}
        description={`Kundennr. ${contact.customerNumber ?? "—"}`}
        actions={
          <>
            <Link href={`/contacts/${contact.id}/edit`}>
              <Button variant="secondary"><Pencil className="size-4" /> Bearbeiten</Button>
            </Link>
            <Link href={`/projects/new?contactId=${contact.id}`}>
              <Button><Briefcase className="size-4" /> Neues Projekt</Button>
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge tone={contact.type === "supplier" ? "warning" : "primary"}>
            {typeLabel[contact.type] ?? contact.type}
          </Badge>
          <Badge>{contact.kind === "company" ? "Firma" : "Person"}</Badge>
          {contact.tags.map((t) => (
            <Badge key={t.id} tone="accent">{t.name}</Badge>
          ))}
        </div>
      </PageHeader>

      <div className="p-6 max-w-7xl mx-auto grid gap-6 lg:grid-cols-3">
        {/* Left: contact info */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Kontaktdaten</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-fg" />
                <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
              </div>
            )}
            {(contact.phone ?? contact.mobile) && (
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-muted-fg" />
                <span>{contact.mobile ?? contact.phone}</span>
              </div>
            )}
            {contact.addresses.map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                <MapPin className="size-4 text-muted-fg mt-0.5" />
                <div>
                  <div>{a.street}</div>
                  <div>{a.zip} {a.city}</div>
                  <div className="text-xs text-muted-fg uppercase">{a.kind}</div>
                </div>
              </div>
            ))}
            {contact.notes && (
              <div className="pt-3 border-t border-border text-muted-fg whitespace-pre-wrap">
                {contact.notes}
              </div>
            )}
            {contact.iban && (
              <div className="pt-3 border-t border-border text-xs text-muted-fg">
                <div>IBAN: <span className="font-mono">{contact.iban}</span></div>
                {contact.bic && <div>BIC: <span className="font-mono">{contact.bic}</span></div>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: projects + persons + assets */}
        <div className="lg:col-span-2 space-y-6">
          <ContactAssetsCard contactId={contact.id} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Projekte</span>
                <span className="text-xs text-muted-fg font-normal">{contact.projects.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.projects.length === 0 ? (
                <p className="text-sm text-muted-fg py-4">Noch keine Projekte für diesen Kontakt.</p>
              ) : (
                <ul className="divide-y divide-border -mx-2">
                  {contact.projects.map((p) => (
                    <li key={p.id} className="px-2 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                          {p.title}
                        </Link>
                        <div className="text-xs text-muted-fg">{p.number}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {p.potentialValue && (
                          <span className="text-sm tabular-nums">{formatMoney(Number(p.potentialValue))}</span>
                        )}
                        <StatusBadge status={p.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {contact.persons.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Ansprechpartner</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border -mx-2">
                  {contact.persons.map((p) => (
                    <li key={p.id} className="px-2 py-3">
                      <div className="font-medium text-sm">
                        {p.salutation} {p.firstName} {p.lastName}
                      </div>
                      <div className="text-xs text-muted-fg">{p.position}</div>
                      <div className="text-xs mt-1 flex gap-3">
                        {p.email && <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>}
                        {p.phone && <span>{p.phone}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
