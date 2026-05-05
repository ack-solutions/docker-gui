import type { Metadata, Viewport } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import { theme } from "@/components/theme";
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
        <AppRouterCacheProvider options={{ key: "mui" }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <NextTopLoader color={theme.palette.primary.main} showSpinner={false} height={2} />
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
