"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { toast } from "sonner";
import { ApiError, apiFetch, isAuthenticated, login } from "@/lib/v2/auth-client";
import { LoadingState, PageShell } from "@/components";

const SETUP_SECRET_HEADER = "x-setup-secret";

type Mode = "loading" | "login" | "bootstrap";

function safeNext(raw: string | null): string {
  if (!raw) return "/containers";
  // Only allow same-origin paths
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/containers";
}

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));

  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Admin");
  const [setupSecret, setSetupSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(next);
      return;
    }
    let cancelled = false;
    // Probe whether bootstrap is available. The endpoint returns 403 when an
    // admin doesn't yet exist (wrong secret) and 409 once one does.
    (async () => {
      try {
        await apiFetch("/api/v1/setup/bootstrap", {
          method: "POST",
          headers: { [SETUP_SECRET_HEADER]: "__probe__" },
          body: JSON.stringify({ email: "x@y.co", password: "12345678", name: "x" }),
          skipAuth: true
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === "setup.invalid_secret") {
            setMode("bootstrap");
            return;
          }
          if (err.code === "setup.already_initialized") {
            setMode("login");
            return;
          }
        }
        setMode("login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "bootstrap") {
        await apiFetch("/api/v1/setup/bootstrap", {
          method: "POST",
          headers: { [SETUP_SECRET_HEADER]: setupSecret },
          body: JSON.stringify({ email, password, name }),
          skipAuth: true
        });
        await login(email, password);
        toast.success("Admin created. Welcome.");
      } else {
        await login(email, password);
        toast.success("Signed in");
      }
      router.replace(next);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "loading") {
    return (
      <PageShell hideChrome maxWidth="sm">
        <Box sx={{ pt: 12 }}>
          <LoadingState />
        </Box>
      </PageShell>
    );
  }

  const isBootstrap = mode === "bootstrap";

  return (
    <PageShell hideChrome maxWidth="sm">
      <Box sx={{ pt: 8 }}>
        <Stack spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <HubOutlinedIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Docker GUI
          </Typography>
        </Stack>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Typography variant="h6">{isBootstrap ? "Create the first admin" : "Sign in"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {isBootstrap
                  ? "No admin exists yet. Create one to start using docker-gui."
                  : "Sign in to manage your server."}
              </Typography>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={onSubmit}>
              <Stack spacing={2}>
                {isBootstrap && (
                  <>
                    <TextField
                      label="Setup secret"
                      type="password"
                      value={setupSecret}
                      onChange={(e) => setSetupSecret(e.target.value)}
                      required
                      fullWidth
                      autoComplete="off"
                      helperText="From SETUP_SECRET in apps/api/.env"
                    />
                    <TextField
                      label="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      fullWidth
                    />
                  </>
                )}
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  autoComplete="email"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  autoComplete={isBootstrap ? "new-password" : "current-password"}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  fullWidth
                >
                  {submitting ? "Working…" : isBootstrap ? "Create admin & sign in" : "Sign in"}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", textAlign: "center", mt: 2 }}
        >
          After login: <code>/containers</code> · <code>/health</code>
        </Typography>
      </Box>
    </PageShell>
  );
}
