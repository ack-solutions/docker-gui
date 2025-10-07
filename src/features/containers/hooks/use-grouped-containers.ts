import { useMemo } from "react";
import type { DockerContainer } from "@/types/docker";

interface ContainerGroup {
  key: string;
  label: string;
  isUngrouped: boolean;
  containers: DockerContainer[];
}

export const useGroupedContainers = (containers: DockerContainer[] | undefined): ContainerGroup[] => {
  return useMemo(() => {
    if (!containers) {
      return [];
    }

    const map = new Map<string, { isUngrouped: boolean; containers: DockerContainer[] }>();

    containers.forEach((container) => {
      const key = container.project?.trim() || "__ungrouped";
      if (!map.has(key)) {
        map.set(key, { isUngrouped: key === "__ungrouped", containers: [] });
      }
      map.get(key)!.containers.push(container);
    });

    return Array.from(map.entries())
      .map(([key, value]) => ({
        key,
        label: key === "__ungrouped" ? "Standalone containers" : key,
        isUngrouped: value.isUngrouped,
        containers: value.containers
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      }))
      .sort((a, b) => {
        if (a.isUngrouped !== b.isUngrouped) {
          return a.isUngrouped ? 1 : -1;
        }
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      });
  }, [containers]);
};

