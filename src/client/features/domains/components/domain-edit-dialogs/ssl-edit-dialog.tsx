"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";
import SslConfiguration from "../ssl-configuration";
import SslCertificateCreateDialog from "../ssl-certificate-create-dialog";
import { useSslCertificates } from "@/features/ssl/hooks/use-ssl-certificates";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sslQueryKeys } from "@/features/ssl/hooks/use-ssl-certificates";
import apiClient from "@/lib/api/client";
import { toast } from "sonner";

interface SslEditDialogProps {
  open: boolean;
  domain: DomainModel;
  onClose: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving: boolean;
}

export default function SslEditDialog({
  open,
  domain,
  onClose,
  onSave,
  isSaving,
}: SslEditDialogProps) {
  const queryClient = useQueryClient();
  const { data: certificates = [], isLoading: certificatesLoading } = useSslCertificates();
  const [enableHttps, setEnableHttps] = useState(domain.target?.enableHttps ?? false);
  const [sslMode, setSslMode] = useState<"none" | "lets-encrypt" | "custom">(
    (domain.target?.sslMode as any) || "none"
  );
  const [letsEncryptEmail, setLetsEncryptEmail] = useState(domain.target?.letsEncryptEmail || "");
  const [customCertId, setCustomCertId] = useState(domain.target?.sslCertificateId || "");
  const [forceHttps, setForceHttps] = useState(domain.target?.forceHttps ?? false);
  const [createCertDialogOpen, setCreateCertDialogOpen] = useState(false);

  const createCertMutation = useMutation({
    mutationFn: async (certData: { commonName: string; certificate: string; privateKey: string }) => {
      try {
        const { data } = await apiClient.post("/ssl/certificates", certData);
        return data;
      } catch (err: any) {
        // Handle 501 Not Implemented gracefully
        if (err?.response?.status === 501) {
          throw new Error("SSL certificate management API is not yet implemented. Please use the SSL/Certificates page to manage certificates.");
        }
        throw err;
      }
    },
    onSuccess: async (newCert) => {
      await queryClient.invalidateQueries({ queryKey: sslQueryKeys.certificates });
      toast.success("SSL certificate created successfully!");
      // Auto-select the newly created certificate
      setCustomCertId(newCert.id);
      setCreateCertDialogOpen(false);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to create certificate";
      toast.error(message);
    },
  });

  useEffect(() => {
    if (open) {
      setEnableHttps(domain.target?.enableHttps ?? false);
      setSslMode((domain.target?.sslMode as any) || "none");
      setLetsEncryptEmail(domain.target?.letsEncryptEmail || "");
      setCustomCertId(domain.target?.sslCertificateId || "");
      setForceHttps(domain.target?.forceHttps ?? false);
    }
  }, [open, domain]);

  const handleSave = async () => {
    const baseTarget = domain.target || {
      type: "none" as const,
      enableHttp: true,
      enableHttps: false,
      forceHttps: false,
      sslMode: "none" as const,
    };

    const targetConfig = {
      ...baseTarget,
      enableHttps,
      forceHttps,
      sslMode: enableHttps ? sslMode : "none",
      letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
      sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || null : null,
    };

    await onSave({ target: targetConfig });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit SSL/TLS Configuration</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1, position: "relative" }}>
          {(isSaving || certificatesLoading) && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  {isSaving ? "Saving..." : "Loading certificates..."}
                </Typography>
              </Stack>
            </Box>
          )}
          <SslConfiguration
            domainName={domain.name}
            enableHttps={enableHttps}
            sslMode={sslMode}
            letsEncryptEmail={letsEncryptEmail}
            certificateId={customCertId}
            forceHttps={forceHttps}
            onEnableHttpsChange={setEnableHttps}
            onSslModeChange={setSslMode}
            onLetsEncryptEmailChange={setLetsEncryptEmail}
            onCertificateIdChange={setCustomCertId}
            onForceHttpsChange={setForceHttps}
            availableCertificates={certificates}
            onCreateCertificate={() => setCreateCertDialogOpen(true)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>

      {/* Create Certificate Dialog */}
      <SslCertificateCreateDialog
        open={createCertDialogOpen}
        domainName={domain.name}
        onClose={() => setCreateCertDialogOpen(false)}
        onCreate={async (certData) => {
          await createCertMutation.mutateAsync(certData);
        }}
        isCreating={createCertMutation.isPending}
      />
    </Dialog>
  );
}

