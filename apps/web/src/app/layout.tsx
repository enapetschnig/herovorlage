import type { Metadata } from "next";
import { TrpcProvider } from "@/lib/trpc-client";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeatFlow",
  description: "Modulare Handwerkersoftware für Wärmepumpen-Installationsbetriebe",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="bg-bg text-fg min-h-screen">
        <TrpcProvider>{children}</TrpcProvider>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
