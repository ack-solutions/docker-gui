"use client";

import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  alpha
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { fetchSettings, saveSetting, cleanupMetricsLogs, type Setting } from "@/lib/api/server";

interface MetricsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface MetricTypeSettings {
  retentionDays: number;
  batchSize: number;
  batchIntervalSeconds: number;
  cleanupEnabled: boolean;
  cleanupIntervalHours: number;
}

const MetricsSettingsDialog = ({ open, onClose }: MetricsSettingsDialogProps) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [cpuSettings, setCpuSettings] = useState<MetricTypeSettings>({
    retentionDays: 7,
    batchSize: 10,
    batchIntervalSeconds: 30,
    cleanupEnabled: true,
    cleanupIntervalHours: 24
  });

  const [memorySettings, setMemorySettings] = useState<MetricTypeSettings>({
    retentionDays: 7,
    batchSize: 10,
    batchIntervalSeconds: 30,
    cleanupEnabled: true,
    cleanupIntervalHours: 24
  });

  const [diskSettings, setDiskSettings] = useState<MetricTypeSettings>({
    retentionDays: 30,
    batchSize: 1,
    batchIntervalSeconds: 3600,
    cleanupEnabled: true,
    cleanupIntervalHours: 24
  });

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const settings = await fetchSettings();
      
      const settingsMap = new Map(settings.map((s: Setting) => [s.key, s]));
      
      // Load CPU settings
      setCpuSettings({
        retentionDays: parseSettingValue(settingsMap.get("METRICS_LOG_RETENTION_DAYS_CPU"), 7),
        batchSize: parseSettingValue(settingsMap.get("METRICS_LOG_BATCH_SIZE_CPU"), 10),
        batchIntervalSeconds: parseSettingValue(settingsMap.get("METRICS_LOG_BATCH_INTERVAL_MS_CPU"), 30000) / 1000,
        cleanupEnabled: parseSettingValue(settingsMap.get("METRICS_CLEANUP_ENABLED_CPU"), true),
        cleanupIntervalHours: parseSettingValue(settingsMap.get("METRICS_CLEANUP_INTERVAL_HOURS_CPU"), 24)
      });

      // Load Memory settings
      setMemorySettings({
        retentionDays: parseSettingValue(settingsMap.get("METRICS_LOG_RETENTION_DAYS_MEMORY"), 7),
        batchSize: parseSettingValue(settingsMap.get("METRICS_LOG_BATCH_SIZE_MEMORY"), 10),
        batchIntervalSeconds: parseSettingValue(settingsMap.get("METRICS_LOG_BATCH_INTERVAL_MS_MEMORY"), 30000) / 1000,
        cleanupEnabled: parseSettingValue(settingsMap.get("METRICS_CLEANUP_ENABLED_MEMORY"), true),
        cleanupIntervalHours: parseSettingValue(settingsMap.get("METRICS_CLEANUP_INTERVAL_HOURS_MEMORY"), 24)
      });

      // Load Disk settings
      setDiskSettings({
        retentionDays: parseSettingValue(settingsMap.get("METRICS_LOG_RETENTION_DAYS_DISK"), 30),
        batchSize: parseSettingValue(settingsMap.get("METRICS_LOG_BATCH_SIZE_DISK"), 1),
        batchIntervalSeconds: parseSettingValue(settingsMap.get("METRICS_LOG_BATCH_INTERVAL_MS_DISK"), 3600000) / 1000,
        cleanupEnabled: parseSettingValue(settingsMap.get("METRICS_CLEANUP_ENABLED_DISK"), true),
        cleanupIntervalHours: parseSettingValue(settingsMap.get("METRICS_CLEANUP_INTERVAL_HOURS_DISK"), 24)
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const parseSettingValue = (setting: Setting | undefined, defaultValue: any): any => {
    if (!setting) return defaultValue;
    
    switch (setting.valueType) {
      case "number":
        return Number(setting.value);
      case "boolean":
        return setting.value === "true";
      default:
        return setting.value;
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await Promise.all([
        // CPU settings
        saveSetting("METRICS_LOG_RETENTION_DAYS_CPU", cpuSettings.retentionDays, "CPU metrics retention period"),
        saveSetting("METRICS_LOG_BATCH_SIZE_CPU", cpuSettings.batchSize, "CPU metrics batch size"),
        saveSetting("METRICS_LOG_BATCH_INTERVAL_MS_CPU", cpuSettings.batchIntervalSeconds * 1000, "CPU metrics batch interval"),
        saveSetting("METRICS_CLEANUP_ENABLED_CPU", cpuSettings.cleanupEnabled, "CPU metrics cleanup enabled"),
        saveSetting("METRICS_CLEANUP_INTERVAL_HOURS_CPU", cpuSettings.cleanupIntervalHours, "CPU metrics cleanup interval"),

        // Memory settings
        saveSetting("METRICS_LOG_RETENTION_DAYS_MEMORY", memorySettings.retentionDays, "Memory metrics retention period"),
        saveSetting("METRICS_LOG_BATCH_SIZE_MEMORY", memorySettings.batchSize, "Memory metrics batch size"),
        saveSetting("METRICS_LOG_BATCH_INTERVAL_MS_MEMORY", memorySettings.batchIntervalSeconds * 1000, "Memory metrics batch interval"),
        saveSetting("METRICS_CLEANUP_ENABLED_MEMORY", memorySettings.cleanupEnabled, "Memory metrics cleanup enabled"),
        saveSetting("METRICS_CLEANUP_INTERVAL_HOURS_MEMORY", memorySettings.cleanupIntervalHours, "Memory metrics cleanup interval"),

        // Disk settings
        saveSetting("METRICS_LOG_RETENTION_DAYS_DISK", diskSettings.retentionDays, "Disk metrics retention period"),
        saveSetting("METRICS_LOG_BATCH_SIZE_DISK", diskSettings.batchSize, "Disk metrics batch size"),
        saveSetting("METRICS_LOG_BATCH_INTERVAL_MS_DISK", diskSettings.batchIntervalSeconds * 1000, "Disk metrics batch interval"),
        saveSetting("METRICS_CLEANUP_ENABLED_DISK", diskSettings.cleanupEnabled, "Disk metrics cleanup enabled"),
        saveSetting("METRICS_CLEANUP_INTERVAL_HOURS_DISK", diskSettings.cleanupIntervalHours, "Disk metrics cleanup interval")
      ]);

      setSuccess("Settings saved successfully! Changes will take effect on next metrics collection.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setCleaningUp(true);
      setError(null);
      setSuccess(null);

      const result = await cleanupMetricsLogs();
      setSuccess(result.message);
    } catch (err) {
      console.error("Failed to cleanup logs:", err);
      setError("Failed to cleanup logs");
    } finally {
      setCleaningUp(false);
    }
  };

  const renderMetricSettings = (
    title: string,
    subtitle: string,
    settings: MetricTypeSettings,
    setSettings: React.Dispatch<React.SetStateAction<MetricTypeSettings>>,
    recommendedInterval?: string
  ) => (
    <Accordion 
      defaultExpanded={title === "CPU"}
      sx={{
        "&:before": {
          display: "none"
        }
      }}
    >
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon />}
        sx={{
          "& .MuiAccordionSummary-content": {
            my: theme.spacing(1.5)
          }
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            {title} Metrics
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={theme.spacing(2.5)}>
          <FormControl fullWidth size="small">
            <InputLabel>Retention Period</InputLabel>
            <Select
              value={settings.retentionDays}
              label="Retention Period"
              onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
            >
              <MenuItem value={1}>1 day</MenuItem>
              <MenuItem value={3}>3 days</MenuItem>
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={14}>14 days</MenuItem>
              <MenuItem value={30}>30 days (recommended for disk)</MenuItem>
              <MenuItem value={60}>60 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
            </Select>
            <FormHelperText>How long to keep {title.toLowerCase()} logs</FormHelperText>
          </FormControl>

          <TextField
            label="Batch Size"
            type="number"
            size="small"
            value={settings.batchSize}
            onChange={(e) => setSettings({ ...settings, batchSize: Number(e.target.value) })}
            fullWidth
            helperText="Number of samples to collect before saving"
            inputProps={{ min: 1, max: 100 }}
          />

          <TextField
            label={`Save Interval (seconds)${recommendedInterval ? ` • ${recommendedInterval}` : ""}`}
            type="number"
            size="small"
            value={settings.batchIntervalSeconds}
            onChange={(e) => setSettings({ ...settings, batchIntervalSeconds: Number(e.target.value) })}
            fullWidth
            helperText="Maximum time between saves"
            inputProps={{ min: 5, max: 7200 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Auto Cleanup</InputLabel>
            <Select
              value={settings.cleanupEnabled ? "enabled" : "disabled"}
              label="Auto Cleanup"
              onChange={(e) => setSettings({ ...settings, cleanupEnabled: e.target.value === "enabled" })}
            >
              <MenuItem value="enabled">Enabled</MenuItem>
              <MenuItem value="disabled">Disabled</MenuItem>
            </Select>
            <FormHelperText>Automatically remove old logs</FormHelperText>
          </FormControl>

          <TextField
            label="Cleanup Interval (hours)"
            type="number"
            size="small"
            value={settings.cleanupIntervalHours}
            onChange={(e) => setSettings({ ...settings, cleanupIntervalHours: Number(e.target.value) })}
            fullWidth
            disabled={!settings.cleanupEnabled}
            helperText="How often to run cleanup"
            inputProps={{ min: 1, max: 168 }}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundImage: "none"
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Metrics Logging Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure separate frequencies for each metric type
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: theme.spacing(3) }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: theme.spacing(6) }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={theme.spacing(2.5)}>
            {error && (
              <Alert severity="error" variant="filled">
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" variant="filled">
                {success}
              </Alert>
            )}

            <Alert 
              severity="info" 
              variant="outlined"
              sx={{
                backgroundColor: alpha(theme.palette.info.main, 0.05)
              }}
            >
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Recommended Settings:
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: theme.spacing(1) }}>
                <strong>• CPU & Memory:</strong> Fast-changing, save every 30 seconds (10 samples at 15s collection rate)
              </Typography>
              <Typography variant="caption" component="div">
                <strong>• Disk:</strong> Slow-changing, save every hour (1 sample at hourly collection)
              </Typography>
            </Alert>

            {renderMetricSettings(
              "CPU",
              "Fast-changing metrics - frequent sampling recommended",
              cpuSettings,
              setCpuSettings,
              "recommended: 30s"
            )}

            {renderMetricSettings(
              "Memory",
              "Fast-changing metrics - frequent sampling recommended",
              memorySettings,
              setMemorySettings,
              "recommended: 30s"
            )}

            {renderMetricSettings(
              "Disk",
              "Slow-changing metrics - hourly sampling recommended",
              diskSettings,
              setDiskSettings,
              "recommended: 3600s (1 hour)"
            )}

            <Box sx={{ pt: theme.spacing(2) }}>
              <Button
                variant="outlined"
                color="warning"
                fullWidth
                onClick={handleCleanup}
                disabled={cleaningUp}
                sx={{ py: theme.spacing(1.5) }}
              >
                {cleaningUp ? "Cleaning up..." : "Run Cleanup Now (All Types)"}
              </Button>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: "block", 
                  mt: theme.spacing(1),
                  px: theme.spacing(1)
                }}
              >
                Manually trigger cleanup for all metric types based on their retention periods
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: theme.spacing(3), py: theme.spacing(2) }}>
        <Button onClick={onClose} disabled={saving} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MetricsSettingsDialog;
