"use client";

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Tooltip } from "@mui/material";
import ImageDetailContent from "@/features/docker/images/components/image-detail-content";

interface ImageDetailDialogProps {
  open: boolean;
  onClose: () => void;
  imageId: string | null;
}

const ImageDetailDialog = ({ open, onClose, imageId }: ImageDetailDialogProps) => {
  const handleOpenInNewTab = () => {
    if (imageId) {
      window.open(`/docker/images/${encodeURIComponent(imageId)}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog 
      open={open && Boolean(imageId)} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          height: "90vh",
          maxHeight: 900
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <span>Image Details</span>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Open in new tab">
              <IconButton size="small" onClick={handleOpenInNewTab}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        {imageId && <ImageDetailContent imageId={imageId} />}
      </DialogContent>
    </Dialog>
  );
};

export default ImageDetailDialog;

