"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DockerLogEntry, attachToContainerLogs, fetchContainerLogs } from "@/lib/api/docker";

export interface UseLogsOptions {
  containerId: string;
}

export const useLogs = ({ containerId }: UseLogsOptions) => {
  const [logs, setLogs] = useState<DockerLogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const lastTimestampRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;

    fetchContainerLogs(containerId).then((data) => {
      if (!disposed) {
        setLogs(data);
        lastTimestampRef.current = data[0]?.timestamp;
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

    const detach = attachToContainerLogs(
      containerId,
      (log) => {
        lastTimestampRef.current = log.timestamp;
        setLogs((current) => [log, ...current].slice(0, 500));
      },
      { since: lastTimestampRef.current }
    );

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
