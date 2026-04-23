import { redirect } from "next/navigation";
import { auth, signOut } from "@heatflow/auth";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";
import { CommandPaletteHost } from "./_components/CommandPaletteHost";
import { AssistantHost } from "./_components/AssistantHost";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session: Awaited<ReturnType<typeof auth>> | null = null;
  let layoutError: { step: string; message: string; stack: string } | null = null;

  try {
    session = await auth();
  } catch (e) {
    layoutError = {
      step: "auth()",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? (e.stack ?? "no stack") : "",
    };
  }

  if (layoutError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4 text-danger">LAYOUT-Fehler (raw)</h1>
        <div className="rounded border border-danger/30 bg-danger/5 p-4 font-mono text-xs whitespace-pre-wrap break-all">
          <div><strong>Step:</strong> {layoutError.step}</div>
          <div><strong>Message:</strong> {layoutError.message}</div>
          <pre className="mt-3 text-[10px] leading-tight">{layoutError.stack}</pre>
        </div>
      </div>
    );
  }

  if (!session?.user) redirect("/login");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="grid grid-cols-[260px_1fr] grid-rows-[auto_1fr] min-h-screen">
      <Sidebar
        user={{
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          role: session.user.role,
        }}
        signOut={handleSignOut}
      />
      <div className="col-start-2 row-start-1 row-span-2 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-bg">{children}</main>
      </div>
      <CommandPaletteHost />
      <AssistantHost />
    </div>
  );
}
