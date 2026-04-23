import { redirect } from "next/navigation";
import { auth, signOut } from "@heatflow/auth";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";
import { CommandPaletteHost } from "./_components/CommandPaletteHost";
import { AssistantHost } from "./_components/AssistantHost";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="grid grid-cols-[248px_1fr] grid-rows-[auto_1fr] min-h-screen bg-gradient-surface">
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
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPaletteHost />
      <AssistantHost />
    </div>
  );
}
