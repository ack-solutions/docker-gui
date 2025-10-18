import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import QueryProvider from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import AppLayout from "@/components/layout/app-layout";
import ThemeRegistry from "@/components/theme/theme-registry";
import PageLoadingBar from "@/components/common/page-loading-bar";
import StoreProvider from "@/store/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Docker Control Center",
  description: "A modern dashboard for managing Docker containers, images, volumes, and networks.",
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" }
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Docker GUI"
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover"
  }
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        
        {/* Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `
          }}
        />
      </head>
      <body>
        <AppRouterCacheProvider options={{ key: "mui" }}>
          <ThemeRegistry>
            <PageLoadingBar />
            <StoreProvider>
              <QueryProvider>
                <AuthProvider>
                  <AppLayout>{children}</AppLayout>
                </AuthProvider>
              </QueryProvider>
            </StoreProvider>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
};

export default RootLayout;
