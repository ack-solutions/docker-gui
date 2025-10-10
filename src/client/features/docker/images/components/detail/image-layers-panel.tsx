"use client";

import StorageIcon from "@mui/icons-material/Storage";
import { Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import moment from "moment";
import { formatBytes } from "@/lib/utils/format";
import type { DockerImageInspect } from "@/types/docker";

interface ImageLayersPanelProps {
  inspect: DockerImageInspect;
}

const ImageLayersPanel = ({ inspect }: ImageLayersPanelProps) => {
  if (inspect.layers.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Layers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Layer information is unavailable for this image.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Layers</Typography>
          <Chip icon={<StorageIcon fontSize="small" />} label={`${inspect.layers.length} layers`} size="small" />
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Digest</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inspect.layers.map((layer) => (
              <TableRow key={layer.digest}>
                <TableCell>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    {layer.digest}
                  </Typography>
                </TableCell>
                <TableCell>{formatBytes(layer.size)}</TableCell>
                <TableCell>
                  {layer.createdAt ? moment(layer.createdAt).format("LLL") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ImageLayersPanel;
