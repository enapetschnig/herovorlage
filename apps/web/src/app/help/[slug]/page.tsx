import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent } from "@heatflow/ui";
import { ARTICLES } from "../_articles";
import { ArrowLeft, Flame } from "lucide-react";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  const related = ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-md bg-primary text-primary-fg grid place-items-center"><Flame className="size-4" /></div>
            HeatFlow Hilfe
          </Link>
          <Link href="/dashboard" className="text-sm text-muted-fg hover:text-fg">Zur App →</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/help" className="text-sm text-muted-fg hover:text-fg flex items-center gap-1 mb-4">
          <ArrowLeft className="size-3.5" /> Zurück zum Help-Center
        </Link>
        <div className="flex items-center gap-2 mb-3">
          <Badge>{article.category}</Badge>
          {article.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">{article.title}</h1>
        <p className="text-lg text-muted-fg mb-6">{article.summary}</p>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed border-t border-border pt-6">
          {article.body}
        </div>
      </article>

      {related.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <h2 className="text-sm uppercase tracking-wider text-muted-fg mb-3">Verwandte Artikel</h2>
          <ul className="space-y-2">
            {related.map((a) => (
              <li key={a.slug}>
                <Link href={`/help/${a.slug}`}>
                  <Card className="hover:border-primary/40 transition-colors">
                    <CardContent className="p-3">
                      <div className="font-medium text-sm">{a.title}</div>
                      <div className="text-xs text-muted-fg mt-0.5">{a.summary}</div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
