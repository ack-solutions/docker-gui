"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import type { ReactNode } from "react";
import { theme } from "@/components/theme";

/**
 * Client-side provider tree. The MUI `theme` contains functions
 * (breakpoints.up/down/…), so it must live entirely on the client — passing it
 * from the Server Component layout to the client <ThemeProvider> fails to
 * serialize in a production build ("Functions cannot be passed directly to
 * Client Components"). Keeping the providers here keeps the theme client-side.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NextTopLoader color={theme.palette.primary.main} showSpinner={false} height={2} />
        {children}
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
