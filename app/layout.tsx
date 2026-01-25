import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arc Station",
  description: "Arc Station MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900">
        <header className="border-b border-zinc-200">
          <nav className="mx-auto flex max-w-5xl gap-4 px-4 py-3 text-sm font-medium">
            <Link href="/bridge">Bridge</Link>
            <Link href="/swap">Swap</Link>
            <Link href="/deploy">Deploy</Link>
            <Link href="/activity">Activity</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
