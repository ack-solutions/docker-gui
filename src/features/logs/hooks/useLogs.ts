"use client";

import { useEffect, useMemo, useState } from "react";
import { DockerLogEntry, attachToContainerLogs, fetchContainerLogs } from "@/lib/api/docker";

export interface UseLogsOptions {
  containerId: string;
}

export const useLogs = ({ containerId }: UseLogsOptions) => {
  const [logs, setLogs] = useState<DockerLogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let disposed = false;

    fetchContainerLogs(containerId).then((data) => {
      if (!disposed) {
        setLogs(data);
      }
    });

    return () => {
      disposed = true;
    };
  }, [containerId]);

  const toggleStreaming = () => {
    setIsStreaming((prev) => !prev);
  };

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const detach = attachToContainerLogs(containerId, (log) => {
      setLogs((current) => [log, ...current].slice(0, 500));
    });

    return detach;
  }, [containerId, isStreaming]);

  const severityCounters = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc[log.level] += 1;
        return acc;
      },
      { info: 0, warn: 0, error: 0 }
    );
  }, [logs]);

  return { logs, isStreaming, toggleStreaming, severityCounters };
};
