import Link from "next/link";
import { Flame } from "lucide-react";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_2fr]">
      {/* Left side: brand */}
      <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-primary/70 text-primary-fg p-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-white/10 grid place-items-center backdrop-blur"><Flame className="size-6" /></div>
          <span className="text-xl font-semibold tracking-tight">HeatFlow</span>
        </Link>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">In 5 Minuten startklar.</h1>
          <ul className="space-y-2 text-sm text-primary-fg/85">
            <li>✓ Tenant + Admin-Account in einem Schritt</li>
            <li>✓ 4 Wärmepumpen-Projekttypen vorkonfiguriert</li>
            <li>✓ 3 Lohngruppen + Zeitkategorien geseedet</li>
            <li>✓ E-Mail-Vorlage für Angebote startklar</li>
            <li>✓ FlowAI-Demo-Modus aktiv (kein API-Key nötig zum Testen)</li>
          </ul>
        </div>
        <p className="text-xs text-primary-fg/70">© epower GmbH · DSGVO-konform · EU-Hosting (Supabase eu-west-1)</p>
      </aside>

      {/* Right side: form */}
      <section className="flex flex-col justify-center p-6 sm:p-12">
        <div className="w-full max-w-2xl mx-auto">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-9 rounded-md bg-primary text-primary-fg grid place-items-center"><Flame className="size-5" /></div>
            <span className="text-lg font-semibold">HeatFlow</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Konto anlegen</h2>
          <p className="text-sm text-muted-fg mt-1.5">
            Du hast schon ein Konto? <Link href="/login" className="text-primary hover:underline">Hier anmelden</Link>
          </p>
          <div className="mt-8">
            <SignupForm />
          </div>
        </div>
      </section>
    </main>
  );
}
