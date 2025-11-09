"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
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
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import { useSetupStatus } from "@/features/setup/hooks/use-setup-status";

const statusColors: Record<string, "default" | "warning" | "success"> = {
  ready: "success",
  "needs-admin": "warning",
  initializing: "warning"
};

const SetupGuide = () => {
  const { data, isLoading, isError, refetch, isFetching } = useSetupStatus();

  if (isLoading) {
    return <Skeleton variant="rounded" height={220} />;
  }

  if (!data || data.state === "ready") {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, width: "100%", maxWidth: 720 }}>
      <CardHeader
        title="Complete initial installation"
        subheader="Follow the steps below to finish bootstrapping the portal."
        action={
          <Button size="small" startIcon={<RefreshIcon fontSize="small" />} onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </Button>
        }
      />
      <CardContent>
        {isError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Unable to load setup status. Retry in a moment.
          </Alert>
        ) : null}

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Current state:
          </Typography>
          <Chip size="small" label={data.state.replace("-", " ")} color={statusColors[data.state] ?? "default"} />
          {data.backgroundTask.running ? (
            <Chip size="small" label="Background tasks running" color="warning" variant="outlined" />
          ) : null}
        </Stack>

        <List dense disablePadding>
          {data.steps.map((step) => (
            <ListItem key={step.id} disableGutters sx={{ alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.2 }}>
                {step.completed ? (
                  <CheckCircleOutlineIcon color="success" fontSize="small" />
                ) : (
                  <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="subtitle2" color={step.completed ? "text.primary" : "text.secondary"}>
                    {step.title}
                  </Typography>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1.5}>
          <Typography variant="subtitle2" color="text.secondary">
            Bootstrap via curl
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Replace the placeholder secret with the value configured under <code>setup.initialSecret</code> in <code>config.yml</code>.
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.50"),
              border: (theme) => `1px solid ${theme.palette.divider}`,
              fontSize: 13,
              overflowX: "auto"
            }}
          >
            <code>{data.curlExample}</code>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SetupGuide;
