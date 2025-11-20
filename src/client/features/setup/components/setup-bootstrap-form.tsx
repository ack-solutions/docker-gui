"use client";

import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { toast } from "sonner";
import { useSetupStatus } from "@/features/setup/hooks/use-setup-status";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SetupBootstrapForm = () => {
  const { data, refetch, isFetching } = useSetupStatus();

  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("admin@example.com");
  const [name, setName] = useState("Super Administrator");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data || data.state !== "needs-admin") {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!secret.trim()) {
      setError("Enter the secret defined under setup.initialSecret in config.yml.");
      return;
    }

    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/setup/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          secret,
          email,
          password,
          name
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Bootstrap failed." }));
        throw new Error(payload.message ?? "Bootstrap failed.");
      }

      toast.success("Administrator created. You can now sign in.");
      setSecret("");
      setPassword("");
      setConfirmPassword("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to bootstrap administrator.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      variant="outlined"
      sx={{ width: "100%", maxWidth: 720, borderRadius: 3, p: 3 }}
    >
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6">Bootstrap Administrator</Typography>
          <Typography variant="body2" color="text.secondary">
            Enter the same secret configured under <code>setup.initialSecret</code> (or the
            <code>SETUP_SECRET</code> environment variable) and provide the first
            administrator credentials.
          </Typography>
        </Box>

        {error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <TextField
          label="Setup Secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          required
          helperText="Defined in config.yml or via the SETUP_SECRET env variable"
        />

        <TextField
          label="Admin Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <TextField
          label="Admin Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            fullWidth
          />
        </Stack>

        <Button
          type="submit"
          variant="contained"
          disabled={submitting || isFetching}
        >
          {submitting ? "Bootstrapping..." : "Create Administrator"}
        </Button>
      </Stack>
    </Paper>
  );
};

export default SetupBootstrapForm;
