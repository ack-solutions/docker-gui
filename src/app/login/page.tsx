"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

const LoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      toast.success(`Welcome back${user.name ? `, ${user.name}` : ""}!`);
      const redirect = searchParams?.get("redirect") ?? "/";
      router.replace(redirect);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Unable to sign in. Check your credentials and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ width: "100%", maxWidth: 420, borderRadius: 3 }}>
      <CardHeader
        avatar={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "primary.main",
              color: "primary.contrastText"
            }}
          >
            <LockOutlinedIcon fontSize="small" />
          </Box>
        }
        title="Sign in to continue"
        subheader="Authenticate to access the operations dashboard."
      />
      <CardContent>
        <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}
          <TextField
            type="email"
            label="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
            autoComplete="email"
          />
          <TextField
            type="password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading || submitting}
            size="large"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Accounts are provisioned by administrators. Contact your admin if you need access.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default LoginPage;
