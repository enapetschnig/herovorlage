"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Badge } from "@heatflow/ui";
import { Loader2, Send, Sparkles, X } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  "Was ist der Status dieses Projekts?",
  "Wann ist die nächste Wartung fällig?",
  "Schreib eine Mail an den Kunden zum Angebot",
  "Wie hoch ist der DATEV-Export für dieses Quartal?",
];

/** Detects context entity from the current route. */
function detectPageContext(pathname: string): { kind: "project" | "contact" | "document" | "page"; id?: string; pathname: string } {
  const m =
    pathname.match(/^\/projects\/([^/]+)/) ??
    pathname.match(/^\/contacts\/([^/]+)/) ??
    pathname.match(/^\/documents\/([^/]+)/);
  if (!m) return { kind: "page", pathname };
  if (pathname.startsWith("/projects/")) return { kind: "project", id: m[1], pathname };
  if (pathname.startsWith("/contacts/")) return { kind: "contact", id: m[1], pathname };
  return { kind: "document", id: m[1], pathname };
}

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => detectPageContext(pathname), [pathname]);

  // Autoscroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamBuf]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const send = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || streaming) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: userText }];
    setMessages(next);
    setStreamBuf("");
    setStreaming(true);

    try {
      const res = await fetch("/api/flowai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, pageContext: ctx }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Parse SSE frames
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const event = eventLine?.slice("event:".length).trim() ?? "message";
          const dataStr = dataLine.slice("data:".length).trim();
          let data: { text?: string; mode?: string; message?: string };
          try { data = JSON.parse(dataStr); } catch { continue; }

          if (event === "status" && data.mode) setMode(data.mode as "live" | "demo");
          if (event === "token" && data.text) {
            assistantText += data.text;
            setStreamBuf(assistantText);
          }
          if (event === "error") {
            assistantText += `\n\n⚠️ Fehler: ${data.message ?? "unbekannt"}`;
            setStreamBuf(assistantText);
          }
        }
      }

      setMessages([...next, { role: "assistant", content: assistantText }]);
      setStreamBuf("");
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : String(e)}` }]);
      setStreamBuf("");
    } finally {
      setStreaming(false);
    }
  };

  if (!open) return null;

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl flex flex-col"
      role="complementary"
      aria-label="FlowAI Assistent"
    >
      <header className="h-14 px-4 border-b border-border flex items-center gap-2 flex-shrink-0">
        <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center">
          <Sparkles className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">FlowAI Assistent</div>
          <div className="text-xs text-muted-fg truncate">
            {ctx.kind === "project" ? "Projekt-Kontext aktiv" : ctx.kind === "contact" ? "Kontakt-Kontext aktiv" : ctx.kind === "document" ? "Dokument-Kontext aktiv" : "Globaler Kontext"}
          </div>
        </div>
        {mode && <Badge tone={mode === "live" ? "success" : "warning"}>{mode === "live" ? "Live" : "Demo"}</Badge>}
        <button onClick={onClose} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg"><X className="size-4" /></button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="space-y-3">
            <div className="text-sm text-muted-fg">
              Ich kenne den Kontext dieser Seite. Frag mich was — oder probier eine Vorlage:
            </div>
            <ul className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((p) => (
                <li key={p}>
                  <button
                    onClick={() => send(p)}
                    className="w-full text-left text-sm px-3 py-2 rounded border border-border bg-bg hover:bg-muted/30"
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} role={m.role} text={m.content} />
        ))}

        {streaming && streamBuf && <Message role="assistant" text={streamBuf} streaming />}
        {streaming && !streamBuf && (
          <div className="flex items-center gap-2 text-sm text-muted-fg">
            <Loader2 className="size-4 animate-spin" /> Claude denkt nach…
          </div>
        )}
      </div>

      <footer className="border-t border-border p-3 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Frag was, ⌘↩ zum Senden…"
            rows={2}
            disabled={streaming}
            className="flex-1 resize-none px-3 py-2 rounded border border-input bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="icon" disabled={!input.trim() || streaming} onClick={() => send()} aria-label="Senden">
            {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <div className="text-xs text-muted-fg mt-2 flex justify-between">
          <span>{ctx.kind !== "page" && `${ctx.kind} #${(ctx.id ?? "").slice(-6)}`}</span>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setStreamBuf(""); }} className="hover:underline">Verlauf leeren</button>
          )}
        </div>
      </footer>
    </aside>
  );
}

function Message({ role, text, streaming }: { role: "user" | "assistant"; text: string; streaming?: boolean }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary text-primary-fg rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">{text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center flex-shrink-0 mt-0.5">
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex-1 text-sm whitespace-pre-wrap leading-relaxed">
        {text}
        {streaming && <span className="inline-block w-1.5 h-3.5 bg-primary/60 ml-0.5 animate-pulse align-middle" />}
      </div>
    </div>
  );
}
