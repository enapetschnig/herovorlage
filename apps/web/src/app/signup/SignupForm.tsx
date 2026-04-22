"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { trpc } from "@/lib/trpc-client";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, FieldGroup, Input } from "@heatflow/ui";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MODULE_OPTIONS = [
  { id: "m3.maintenance", label: "Wartungsverträge", recommended: true, price: "€15" },
  { id: "m12.flow_ai", label: "FlowAI", recommended: true, price: "€29/User" },
  { id: "m7.funding", label: "Förderungsmanagement", recommended: true, price: "€19" },
  { id: "m1.datanorm", label: "Datanorm-Import", price: "€9" },
  { id: "m5.calculation", label: "Soll/Ist-Kalkulation", price: "€10" },
  { id: "m10.datev", label: "DATEV-Export", price: "€15" },
  { id: "m11.sepa", label: "SEPA + Mahnwesen", price: "€12" },
  { id: "m6.warehouse", label: "Lagerverwaltung", price: "€15" },
  { id: "m4.planning", label: "Plantafel", price: "€12/User" },
  { id: "m14.kanban", label: "Kanban + Chat", price: "€9" },
  { id: "m13.checklists", label: "Checklisten", price: "€9" },
  { id: "m8.heat_load", label: "Heizlast-Anbindung", price: "€9" },
];

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [country, setCountry] = useState<"AT" | "DE" | "CH">("AT");
  const [vatId, setVatId] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(["m3.maintenance", "m12.flow_ai", "m7.funding"]),
  );

  const signup = trpc.tenant.signup.useMutation();

  const next = () => {
    if (!companyName || !ownerName || !email || !password) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      await signup.mutateAsync({
        companyName,
        legalName: legalName || undefined,
        country,
        street: street || undefined,
        zip: zip || undefined,
        city: city || undefined,
        vatId: vatId || undefined,
        ownerName,
        email,
        password,
        modules: Array.from(selectedModules),
      });

      toast.success("Konto erstellt — du wirst angemeldet…");
      // Auto-login
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/login");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`size-6 rounded-full grid place-items-center text-xs font-bold ${step === 1 ? "bg-primary text-primary-fg" : "bg-success text-white"}`}>
          {step === 1 ? "1" : <CheckCircle2 className="size-3.5" />}
        </span>
        <span className={step === 1 ? "font-medium" : "text-muted-fg"}>Stammdaten + Account</span>
        <span className="text-muted-fg">→</span>
        <span className={`size-6 rounded-full grid place-items-center text-xs font-bold ${step === 2 ? "bg-primary text-primary-fg" : "bg-muted text-muted-fg"}`}>2</span>
        <span className={step === 2 ? "font-medium" : "text-muted-fg"}>Module wählen</span>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Betrieb + Admin-Konto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup columns={2}>
              <Field label="Firmenname" required>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="z.B. epower GmbH" required autoFocus />
              </Field>
              <Field label="Rechtlicher Name">
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="optional, falls abweichend" />
              </Field>
              <Field label="Land">
                <select value={country} onChange={(e) => setCountry(e.target.value as "AT" | "DE" | "CH")} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
                  <option value="AT">Österreich</option>
                  <option value="DE">Deutschland</option>
                  <option value="CH">Schweiz</option>
                </select>
              </Field>
              <Field label="UID/UStId">
                <Input value={vatId} onChange={(e) => setVatId(e.target.value)} placeholder={country === "AT" ? "ATU…" : country === "DE" ? "DE…" : "CHE-…"} />
              </Field>
              <Field label="Straße + Hausnr." className="sm:col-span-2">
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </Field>
              <Field label="PLZ"><Input value={zip} onChange={(e) => setZip(e.target.value)} /></Field>
              <Field label="Ort"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            </FieldGroup>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium mb-3">Dein Admin-Konto</h3>
              <FieldGroup columns={2}>
                <Field label="Dein Name" required>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Max Mustermann" required />
                </Field>
                <Field label="E-Mail" required>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
                <Field label="Passwort" required hint="Min. 8 Zeichen">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                <Field label="Passwort bestätigen" required>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </Field>
              </FieldGroup>
            </div>

            {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded p-2.5">{error}</div>}

            <div className="flex justify-end pt-2">
              <Button onClick={next}><ArrowRight className="size-4" /> Weiter zu Modulen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Module auswählen</CardTitle>
            <p className="text-sm text-muted-fg">Was du jetzt nicht aktivierst, kannst du später jederzeit dazubuchen.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              {MODULE_OPTIONS.map((m) => (
                <li key={m.id}>
                  <label className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-bg hover:bg-muted/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModules.has(m.id)}
                      onChange={(e) => {
                        const s = new Set(selectedModules);
                        if (e.target.checked) s.add(m.id); else s.delete(m.id);
                        setSelectedModules(s);
                      }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{m.label}</div>
                      {m.recommended && <div className="text-xs text-primary">Empfohlen für WP-Betriebe</div>}
                    </div>
                    <div className="text-xs text-muted-fg tabular-nums">{m.price}</div>
                  </label>
                </li>
              ))}
            </ul>

            <div className="text-xs text-muted-fg p-3 bg-muted/30 rounded">
              💡 <strong>Demo-Modus:</strong> Im Test-Tenant kostet alles €0. Erst beim Upgrade auf Produktiv-Modus aktivierst du Stripe-Billing.
            </div>

            {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded p-2.5">{error}</div>}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>← Zurück</Button>
              <Button onClick={submit} disabled={pending} size="lg">
                {pending ? <><Loader2 className="size-4 animate-spin" /> Erstelle Tenant…</> : <><CheckCircle2 className="size-4" /> Konto erstellen</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
