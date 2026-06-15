import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

// Admin UI is fully dynamic — auth state and live data, never static.
// Skips Next's prerender pass which would otherwise time out on the
// client-only auth bootstrap.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Docker GUI",
  description: "Self-hosted server management"
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }
  ],
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
