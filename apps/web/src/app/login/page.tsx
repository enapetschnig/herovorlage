import { LoginForm } from "./LoginForm";
import { Flame } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: marketing panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-primary/70 text-primary-fg p-12">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-white/10 grid place-items-center backdrop-blur">
            <Flame className="size-6" />
          </div>
          <span className="text-xl font-semibold tracking-tight">HeatFlow</span>
        </div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">
            Die Handwerkersoftware für Wärmepumpen-Profis.
          </h1>
          <p className="text-primary-fg/85 text-sm leading-relaxed">
            Modular, mobile-first, KI-nativ. Vom Lead bis zur bezahlten Rechnung — und der Wartung danach.
          </p>
        </div>
        <p className="text-xs text-primary-fg/70">© epower GmbH · Klagenfurt am Wörthersee · DSGVO-konform · EU-Hosting</p>
      </aside>

      {/* Right: login form */}
      <section className="flex flex-col justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-9 rounded-md bg-primary text-primary-fg grid place-items-center">
              <Flame className="size-5" />
            </div>
            <span className="text-lg font-semibold">HeatFlow</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Anmelden</h2>
          <p className="text-sm text-muted-fg mt-1.5">
            Willkommen zurück. Melde dich mit deinem Konto an.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
          <div className="mt-8 text-xs text-muted-fg p-3 rounded-md border border-dashed border-border bg-muted/40">
            <strong className="text-fg">Demo-Login:</strong>{" "}
            <code className="font-mono text-fg">admin@demo.heatflow.local</code> / <code className="font-mono text-fg">demo1234</code>
          </div>
        </div>
      </section>
    </main>
  );
}
