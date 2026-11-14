import "~/styles/globals.css";

import { type Metadata } from "next";
import { TRPCReactProvider } from "~/trpc/react";
import { Nav } from "./_components/nav";

export const metadata: Metadata = {
  title: "JobHunt",
  description: "Suivi de recherche d'emploi : offres, compatibilité CV, candidatures, relances",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gradient-to-b from-indigo-50 to-zinc-50 text-zinc-900 antialiased">
        <header className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 shadow-md">
          <Nav />
        </header>
        <TRPCReactProvider>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
