import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import QueryProvider from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import AppLayout from "@/components/layout/app-layout";
import ThemeRegistry from "@/components/theme/theme-registry";
import StoreProvider from "@/store/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Docker Control Center",
  description: "A modern dashboard for managing Docker containers, images, volumes, and networks."
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider options={{ key: "mui" }}>
          <ThemeRegistry>
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
