"use client";

import { Card, CardContent, Chip, Stack, Tooltip, Typography, Box } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import LayersIcon from "@mui/icons-material/Layers";
import ActionIconButton from "@/components/common/action-icon-button";
import { formatBytes } from "@/lib/utils/format";
import type { DockerImage } from "@/types/docker";
import moment from "moment";

interface ImageListItemMobileProps {
  image: DockerImage;
  onRun?: (tag: string) => void;
  onDelete?: (imageId: string, tag: string) => void;
  onMenuOpen?: (imageId: string, anchor: HTMLElement) => void;
  onViewDetail?: (imageId: string) => void;
}

const ImageListItemMobile = ({
  image,
  onRun,
  onDelete,
  onMenuOpen,
  onViewDetail
}: ImageListItemMobileProps) => {
  const primaryTag = image.repoTags[0] || image.id.slice(0, 12);
  const hasMultipleTags = image.repoTags.length > 1;

  return (
    <Card 
      onClick={() => onViewDetail?.(image.id)}
      sx={{ 
        touchAction: "manipulation",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        "&:active": {
          transform: "scale(0.99)",
          boxShadow: 1
        }
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack spacing={1.5}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box flex={1} minWidth={0}>
              <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                <LayersIcon fontSize="small" color="primary" />
                <Typography 
                  variant="subtitle1" 
                  fontWeight={600}
                  sx={{ 
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: "0.95rem"
                  }}
                >
                  {primaryTag}
                </Typography>
              </Stack>
              {hasMultipleTags && (
                <Typography variant="caption" color="text.secondary">
                  +{image.repoTags.length - 1} more tag{image.repoTags.length > 2 ? "s" : ""}
                </Typography>
              )}
            </Box>
            <ChevronRightIcon fontSize="small" color="action" />
          </Stack>

          {/* Info Chips */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
            <Chip 
              label={formatBytes(image.size)} 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ fontSize: "0.7rem", height: 20 }}
            />
            <Chip 
              label={`ID: ${image.id.slice(0, 12)}`}
              size="small" 
              variant="outlined"
              sx={{ fontSize: "0.7rem", height: 20 }}
            />
            <Typography variant="caption" color="text.secondary">
              {moment(image.createdAt).fromNow()}
            </Typography>
          </Stack>

          {/* Quick Actions */}
          <Stack 
            direction="row" 
            spacing={0.5} 
            justifyContent="flex-end"
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title="Run container">
              <ActionIconButton
                color="primary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRun?.(primaryTag);
                }}
              >
                <PlayArrowIcon fontSize="small" />
              </ActionIconButton>
            </Tooltip>
            <Tooltip title="Delete image">
              <ActionIconButton
                color="error"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(image.id, primaryTag);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </ActionIconButton>
            </Tooltip>
            <Tooltip title="More">
              <ActionIconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuOpen?.(image.id, e.currentTarget);
                }}
              >
                <MoreHorizIcon fontSize="small" />
              </ActionIconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ImageListItemMobile;

