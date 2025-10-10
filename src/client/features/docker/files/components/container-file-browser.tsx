"use client";

import { MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import FileBrowser from "@/features/docker/files/components/file-browser";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";

interface ContainerFileBrowserProps {
  initialContainerId?: string;
}

const ContainerFileBrowser = ({ initialContainerId }: ContainerFileBrowserProps) => {
  const { data: containers } = useContainers();
  const defaultContainerId = useMemo(
    () => initialContainerId ?? containers?.[0]?.id ?? "1a2b3c",
    [containers, initialContainerId]
  );
  const [containerId, setContainerId] = useState(defaultContainerId);

  useEffect(() => {
    if (containers && containers.length > 0) {
      setContainerId((current) =>
        containers.some((item) => item.id === current) ? current : containers[0].id
      );
    }
  }, [containers]);

  return (
    <Stack spacing={3}>
      <TextField
        select
        label="Select container"
        size="small"
        value={containerId}
        onChange={(event) => setContainerId(event.target.value)}
        sx={{ maxWidth: 320 }}
      >
        {containers?.map((container) => (
          <MenuItem key={container.id} value={container.id}>
            {container.name}
          </MenuItem>
        )) ?? [
          <MenuItem key="demo" value="1a2b3c">
            Demo container
          </MenuItem>
        ]}
      </TextField>
      <FileBrowser containerId={containerId} />
    </Stack>
  );
};

export default ContainerFileBrowser;
