"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Domain as DomainModel } from "@/types/server";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";

interface RoutingSectionEditorProps {
  domain: DomainModel;
  onEdit: () => void;
}

export default function RoutingSectionEditor({
  domain,
  onEdit,
}: RoutingSectionEditorProps) {
  const { data: containers = [] } = useContainers({ refetchOnWindowFocus: false });

  const getTargetInfo = () => {
    if (!domain.target || domain.target.type === "none") {
      return {
        type: "DNS Only",
        description: "No routing configured - domain will only handle DNS queries",
        details: [],
      };
    }
    switch (domain.target.type) {
      case "container": {
        const container = containers.find((c) => c.id === domain.target?.containerId);
        return {
          type: "Docker Container",
          description: "Traffic is routed to a Docker container",
          details: [
            { label: "Container", value: container?.name || domain.target.containerId || "N/A" },
            { label: "Port", value: domain.target.containerPort?.toString() || "N/A" },
            { label: "Image", value: container?.image || "N/A" },
          ],
        };
      }
      case "external":
        return {
          type: "External URL",
          description: "Traffic is forwarded to an external URL",
          details: [
            { label: "URL", value: domain.target.externalUrl || "N/A" },
          ],
        };
      case "service":
        return {
          type: "Internal Service",
          description: "Traffic is routed to an internal service",
          details: [
            { label: "Service Host", value: domain.target.serviceHost || "N/A" },
          ],
        };
      case "static":
        return {
          type: "Static Files",
          description: "Serves static files from a directory",
          details: [
            { label: "Root Directory", value: domain.target.staticRoot || "N/A" },
          ],
        };
      default:
        return {
          type: "Not configured",
          description: "Routing is not configured",
          details: [],
        };
    }
  };

  const targetInfo = getTargetInfo();

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Routing Configuration
        </Typography>
        <IconButton onClick={onEdit} size="small" color="primary">
          <EditIcon />
        </IconButton>
      </Stack>

      <Stack spacing={2}>
        <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Stack spacing={1.5}>
            <Typography variant="body1" fontWeight={600}>
              {targetInfo.type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {targetInfo.description}
            </Typography>
            {targetInfo.details.length > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {targetInfo.details.map((detail, idx) => (
                  <Stack key={idx} direction="row" spacing={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      {detail.label}:
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {detail.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

