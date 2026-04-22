"use client";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Avatar, Button } from "@heatflow/ui";
import { formatAgo } from "@heatflow/utils";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

export function ProjectChatTab({ projectId }: { projectId: string }) {
  const q = trpc.projectMessages.list.useQuery({ projectId, limit: 200 }, { refetchInterval: 15_000 });
  const send = trpc.projectMessages.send.useMutation({
    onSuccess: () => { setText(""); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [q.data]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    send.mutate({ projectId, message: text.trim() });
  };

  if (q.isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-fg"><Loader2 className="size-5 animate-spin" /></div>;
  }

  const messages = q.data ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted-fg">
            <MessageSquare className="size-8 mx-auto mb-2" />
            <p className="text-sm">Noch keine Nachrichten in diesem Projekt.</p>
            <p className="text-xs mt-1">Schreib die erste Notiz oder Frage ans Team.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex items-start gap-3">
              <Avatar name={m.authorName ?? m.externalEmail ?? "?"} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{m.authorName ?? m.externalEmail ?? "Extern"}</span>
                  <span className="text-xs text-muted-fg">{formatAgo(m.createdAt)}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed mt-0.5">{m.message}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 mt-4 pt-3 border-t border-border">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          placeholder="Nachricht schreiben…"
          rows={2}
          className="flex-1 resize-none px-3 py-2 rounded border border-input bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={!text.trim() || send.isPending}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
