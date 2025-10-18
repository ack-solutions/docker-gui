"use client";

import { Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import moment from "moment";
import type { DockerImageInspect } from "@/types/docker";
import { formatBytes } from "@/lib/utils/format";

interface ImageHistoryPanelProps {
  inspect: DockerImageInspect;
}

const ImageHistoryPanel = ({ inspect }: ImageHistoryPanelProps) => {
  if (inspect.history.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">
          History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No build history reported for this image.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">
        History
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Created</TableCell>
            <TableCell>Instruction</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Comment</TableCell>
            <TableCell>Tags</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inspect.history.map((entry) => (
            <TableRow key={`${entry.id}-${entry.created}`}>
              <TableCell>{moment(entry.created).format("LLL")}</TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {entry.createdBy || "—"}
                </Typography>
              </TableCell>
              <TableCell>{formatBytes(entry.size)}</TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                  {entry.comment || "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {entry.tags.length ? entry.tags.join(", ") : "—"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
};

export default ImageHistoryPanel;
