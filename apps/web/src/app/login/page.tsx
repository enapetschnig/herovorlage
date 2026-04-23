import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { Flame, Shield, Sparkles, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: brand panel */}
      <aside className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-gradient-brand text-primary-fg p-12">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 size-96 rounded-full bg-white/10 blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 size-96 rounded-full bg-accent/30 blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="size-11 rounded-xl bg-white/15 grid place-items-center backdrop-blur-sm ring-1 ring-white/20">
            <Flame className="size-6" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight">HeatFlow</div>
            <div className="text-xs text-primary-fg/70 font-medium">Handwerkersoftware 2026</div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-lg">
          <h1 className="text-4xl font-semibold tracking-tight leading-[1.1]">
            Die Handwerkersoftware für Wärmepumpen-Profis.
          </h1>
          <p className="text-primary-fg/85 text-base leading-relaxed">
            Vom Lead bis zur bezahlten Rechnung — und der Wartung danach. Modular, mobile-first, KI-nativ.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-4">
            <FeatureChip icon={<Wrench className="size-4" />} label="Wartung & Anlagen" />
            <FeatureChip icon={<Sparkles className="size-4" />} label="FlowAI" />
            <FeatureChip icon={<Shield className="size-4" />} label="DSGVO · EU-Hosting" />
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-primary-fg/70">
          <p>© epower GmbH · Klagenfurt</p>
          <p className="tabular-nums">v1.0</p>
        </div>
      </aside>

      {/* Right: login form */}
      <section className="flex flex-col justify-center p-6 sm:p-12 bg-gradient-surface">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="size-10 rounded-lg bg-gradient-brand text-primary-fg grid place-items-center shadow-md">
              <Flame className="size-5" strokeWidth={2.2} />
            </div>
            <span className="text-lg font-semibold tracking-tight">HeatFlow</span>
          </div>

          <div className="space-y-1.5 mb-8">
            <h2 className="text-[28px] font-semibold tracking-tight leading-tight">Willkommen zurück</h2>
            <p className="text-sm text-muted-fg">Melde dich an, um auf dein Dashboard zuzugreifen.</p>
          </div>

          <Suspense fallback={<div className="h-40" />}>
            <LoginForm />
          </Suspense>

          <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="size-1.5 rounded-full bg-accent animate-pulse" />
              <strong className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Demo-Zugang</strong>
            </div>
            <div className="text-xs text-muted-fg">
              <code className="font-mono text-fg">admin@demo.heatflow.local</code> / <code className="font-mono text-fg">demo1234</code>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-white/10 backdrop-blur-sm p-3 ring-1 ring-white/15">
      <div className="size-7 rounded-md bg-white/15 grid place-items-center">{icon}</div>
      <div className="text-xs font-medium text-primary-fg/95 leading-tight">{label}</div>
    </div>
  );
}
