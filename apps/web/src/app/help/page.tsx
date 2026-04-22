import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { ARTICLES, CATEGORIES } from "./_articles";
import { ArrowRight, Flame, Search } from "lucide-react";

export default function HelpCenterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <HelpCenter searchParams={searchParams} />;
}

async function HelpCenter({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = q
    ? ARTICLES.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-md bg-primary text-primary-fg grid place-items-center"><Flame className="size-4" /></div>
            HeatFlow Hilfe
          </Link>
          <Link href="/dashboard" className="text-sm text-muted-fg hover:text-fg">Zur App →</Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3">Hilfe-Center</h1>
        <p className="text-muted-fg mb-8">Anleitungen, Tipps und Antworten auf häufige Fragen</p>
        <form method="get" className="max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-fg" />
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Was möchtest du wissen?"
            className="w-full h-11 pl-10 pr-3 rounded-lg border border-border bg-card text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        {filtered ? (
          <>
            <h2 className="text-lg font-semibold mb-3">{filtered.length} Treffer für „{q}"</h2>
            {filtered.length === 0 && (
              <p className="text-muted-fg text-sm">Nichts gefunden. Versuche eine andere Formulierung oder schreib uns: <a href="mailto:hallo@epowergmbh.at" className="text-primary hover:underline">hallo@epowergmbh.at</a></p>
            )}
            <ul className="space-y-3">
              {filtered.map((a) => (
                <li key={a.slug}>
                  <Link href={`/help/${a.slug}`}>
                    <Card className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge>{a.category}</Badge>
                          {a.tags.slice(0, 3).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
                        </div>
                        <h3 className="font-semibold">{a.title}</h3>
                        <p className="text-sm text-muted-fg mt-1">{a.summary}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {CATEGORIES.map((cat) => {
              const articles = ARTICLES.filter((a) => a.category === cat.name);
              return (
                <Card key={cat.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <cat.icon className="size-4 text-primary" /> {cat.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {articles.map((a) => (
                        <li key={a.slug}>
                          <Link
                            href={`/help/${a.slug}`}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-muted/30 text-sm"
                          >
                            <span>{a.title}</span>
                            <ArrowRight className="size-3.5 text-muted-fg flex-shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6 text-sm text-muted-fg flex items-center justify-between">
          <span>Frage nicht beantwortet?</span>
          <a href="mailto:hallo@epowergmbh.at" className="text-primary hover:underline">hallo@epowergmbh.at</a>
        </div>
      </footer>
    </div>
  );
}
