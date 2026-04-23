"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Etwas ist schiefgelaufen</h1>
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 mb-4">
        <div className="font-mono text-sm font-medium text-danger">{error.message || "Unknown error"}</div>
        {error.digest && (
          <div className="text-xs text-muted-fg mt-2">Digest: {error.digest}</div>
        )}
      </div>
      {error.stack && (
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-muted-fg">Stack Trace</summary>
          <pre className="mt-2 p-3 rounded bg-muted overflow-x-auto text-xs whitespace-pre-wrap">
            {error.stack}
          </pre>
        </details>
      )}
      <button onClick={reset} className="px-4 py-2 rounded-md bg-primary text-primary-fg text-sm">
        Erneut versuchen
      </button>
    </div>
  );
}
