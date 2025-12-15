"use client";

import { useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import InfoIcon from "@mui/icons-material/Info";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CodeIcon from "@mui/icons-material/Code";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { toast } from "sonner";
import { useSetupStatus } from "@/features/setup/hooks/use-setup-status";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`setup-tabpanel-${index}`}
      aria-labelledby={`setup-tab-${index}`}
      sx={{ height: "100%", overflow: "auto" }}
    >
      {value === index && <Box sx={{ py: 1.5 }}>{children}</Box>}
    </Box>
  );
};

const SetupWizard = () => {
  const { data, isLoading, isError, refetch, isFetching } = useSetupStatus();
  const [activeTab, setActiveTab] = useState(0);
  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("admin@example.com");
  const [name, setName] = useState("Super Administrator");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton variant="rounded" height={600} />;
  }

  if (!data || data.state === "ready") {
    return null;
  }

  const statusColors: Record<string, "default" | "warning" | "success"> = {
    ready: "success",
    "needs-admin": "warning",
    initializing: "warning"
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

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

  // Determine active step based on setup status
  const getActiveStep = () => {
    if (!data) return 0;
    if (!data.secretConfigured) return 0;
    if (!data.adminExists) return 1;
    return 2;
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        width: "100%",
        maxWidth: 900,
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <CardHeader
        title="Initial Setup"
        subheader="Complete the steps below to bootstrap your Docker GUI installation."
        action={
          <Button
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        }
        sx={{ pb: 1.5 }}
      />
      <Divider />

      {/* Stepper */}
      <Box sx={{ px: 3, pt: 1.5, pb: 1 }}>
        <Stepper activeStep={getActiveStep()} alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: "0.75rem" } }}>
          <Step>
            <StepLabel
              StepIconComponent={({ active, completed }) => (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: completed
                      ? "success.main"
                      : active
                        ? "primary.main"
                        : "action.disabledBackground",
                    color: completed || active ? "white" : "action.disabled"
                  }}
                >
                  {completed ? (
                    <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                  ) : (
                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.7rem" }}>
                      1
                    </Typography>
                  )}
                </Box>
              )}
            >
              Configure Secret
            </StepLabel>
          </Step>
          <Step>
            <StepLabel
              StepIconComponent={({ active, completed }) => (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: completed
                      ? "success.main"
                      : active
                        ? "primary.main"
                        : "action.disabledBackground",
                    color: completed || active ? "white" : "action.disabled"
                  }}
                >
                  {completed ? (
                    <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                  ) : (
                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.7rem" }}>
                      2
                    </Typography>
                  )}
                </Box>
              )}
            >
              Create Admin
            </StepLabel>
          </Step>
          <Step>
            <StepLabel
              StepIconComponent={({ active, completed }) => (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: completed
                      ? "success.main"
                      : active
                        ? "primary.main"
                        : "action.disabledBackground",
                    color: completed || active ? "white" : "action.disabled"
                  }}
                >
                  {completed ? (
                    <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                  ) : (
                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.7rem" }}>
                      3
                    </Typography>
                  )}
                </Box>
              )}
            >
              Complete
            </StepLabel>
          </Step>
        </Stepper>
      </Box>

      <Divider />

      {/* Status Chip */}
      <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Status:
          </Typography>
          <Chip
            size="small"
            label={data.state.replace("-", " ")}
            color={statusColors[data.state] ?? "default"}
          />
          {data.backgroundTask.running ? (
            <Chip
              size="small"
              label="Background tasks running"
              color="warning"
              variant="outlined"
            />
          ) : null}
        </Stack>
      </Box>

      <Divider />

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="setup tabs">
          <Tab
            icon={<InfoIcon />}
            iconPosition="start"
            label="Overview"
            id="setup-tab-0"
            aria-controls="setup-tabpanel-0"
          />
          <Tab
            icon={<PersonAddIcon />}
            iconPosition="start"
            label="Create Admin"
            id="setup-tab-1"
            aria-controls="setup-tabpanel-1"
          />
          <Tab
            icon={<CodeIcon />}
            iconPosition="start"
            label="CLI Instructions"
            id="setup-tab-2"
            aria-controls="setup-tabpanel-2"
          />
        </Tabs>
      </Box>

      {/* Tab Content - Scrollable */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          minHeight: 0
        }}
      >
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={1.5} sx={{ px: 3, pb: 2 }}>
            {isError ? (
              <Alert severity="error" sx={{ mb: 0.5 }}>
                Unable to load setup status. Retry in a moment.
              </Alert>
            ) : null}

            <Typography variant="subtitle1" fontWeight={600}>
              Setup Steps
            </Typography>
            <List dense disablePadding>
              {data.steps?.map((step) => (
                <ListItem key={step.id} disableGutters sx={{ alignItems: "flex-start", py: 0.75 }}>
                  <ListItemIcon sx={{ minWidth: 28, mt: 0.1 }}>
                    {step.completed ? (
                      <CheckCircleOutlineIcon color="success" fontSize="small" />
                    ) : (
                      <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        fontWeight={step.completed ? 500 : 400}
                        color={step.completed ? "text.primary" : "text.secondary"}
                      >
                        {step.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 1 }} />

            <Typography variant="caption" color="text.secondary">
              Follow the steps above to complete the setup. Use the tabs to navigate between
              different setup methods.
            </Typography>
          </Stack>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box component="form" onSubmit={handleSubmit} sx={{ px: 3, pb: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={600}>
                Create Administrator Account
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Enter the setup secret and provide credentials for the first administrator account.
              </Typography>

              {error ? (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 0.5 }}>
                  {error}
                </Alert>
              ) : null}

              <TextField
                label="Setup Secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                required
                fullWidth
                size="small"
                helperText="Defined in config.yml or via the SETUP_SECRET env variable"
              />

              <TextField
                label="Admin Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
                size="small"
              />

              <TextField
                label="Admin Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                fullWidth
                size="small"
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  fullWidth
                  size="small"
                  helperText="Minimum 10 characters"
                />
                <TextField
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  fullWidth
                  size="small"
                />
              </Stack>

              <Button
                type="submit"
                variant="contained"
                disabled={submitting || isFetching}
                size="medium"
                fullWidth
                sx={{ mt: 0.5 }}
              >
                {submitting ? "Creating Administrator..." : "Create Administrator"}
              </Button>
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Stack spacing={1.5} sx={{ px: 3, pb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Bootstrap via Command Line
            </Typography>
            <Typography variant="caption" color="text.secondary">
              You can also create the administrator account using curl from the command line.
              Replace the placeholder secret with the value configured under{" "}
              <code>setup.initialSecret</code> in <code>config.yml</code>.
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "grey.900" : "grey.50"
              }}
            >
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontSize: 12,
                  overflowX: "auto",
                  fontFamily: "monospace"
                }}
              >
                <code>{data.curlExample}</code>
              </Box>
            </Paper>
            <Typography variant="caption" color="text.secondary">
              After running this command, refresh the page to see the updated status.
            </Typography>
          </Stack>
        </TabPanel>
      </Box>
    </Card>
  );
};

export default SetupWizard;

