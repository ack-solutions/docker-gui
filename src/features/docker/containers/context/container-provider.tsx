"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  createContainer as apiCreateContainer,
  fetchContainers,
  pruneStoppedContainers,
  pruneUnusedImages,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer
} from "@/lib/api/docker";
import { containerQueryKeys } from "@/features/docker/containers/constants";
import { imageQueryKeys } from "@/features/docker/images/hooks/use-images";
import type {
  CreateContainerRequest,
  DockerContainer,
  DockerPruneSummary
} from "@/types/docker";

type ContainerAction = "start" | "stop" | "restart" | "delete";
type GroupAction = "start" | "stop" | "restart" | "delete";

interface ContainerActionState {
  action: ContainerAction;
  startedAt: number;
}

interface ContainerBulkActionState {
  action: GroupAction;
  startedAt: number;
  targetIds: string[];
}

type ContainerTarget = Pick<DockerContainer, "id" | "name">;

interface ContainerContextValue {
  query: UseQueryResult<DockerContainer[]>;
  actions: {
    start: (target: ContainerTarget) => Promise<void>;
    stop: (target: ContainerTarget) => Promise<void>;
    restart: (target: ContainerTarget) => Promise<void>;
    remove: (target: ContainerTarget) => Promise<void>;
    startMany: (targets: ContainerTarget[]) => Promise<void>;
    stopMany: (targets: ContainerTarget[]) => Promise<void>;
    restartMany: (targets: ContainerTarget[]) => Promise<void>;
    removeMany: (targets: ContainerTarget[]) => Promise<void>;
    pruneContainers: () => Promise<DockerPruneSummary>;
    pruneImages: () => Promise<DockerPruneSummary>;
    create: (payload: CreateContainerRequest) => Promise<DockerContainer>;
  };
  state: {
    getContainerAction: (id: string) => ContainerActionState | null;
    isContainerActionInFlight: (id: string) => boolean;
    bulkAction: ContainerBulkActionState | null;
    isPruningContainers: boolean;
    isPruningImages: boolean;
  };
  refresh: () => Promise<void>;
}

const ContainerContext = createContext<ContainerContextValue | null>(null);

const toTarget = (target: ContainerTarget): ContainerTarget => ({
  id: target.id,
  name: target.name
});

const uniqueTargets = (targets: ContainerTarget[]) => {
  const seen = new Map<string, ContainerTarget>();
  targets.forEach((target) => {
    if (!seen.has(target.id)) {
      seen.set(target.id, toTarget(target));
    }
  });
  return Array.from(seen.values());
};

interface ContainerProviderProps {
  children: ReactNode;
  refetchIntervalMs?: number;
}

export const ContainerProvider = ({
  children,
  refetchIntervalMs = 10_000
}: ContainerProviderProps) => {
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<Record<string, ContainerActionState>>({});
  const [bulkState, setBulkState] = useState<ContainerBulkActionState | null>(null);
  const [isPruningContainers, setIsPruningContainers] = useState(false);
  const [isPruningImages, setIsPruningImages] = useState(false);

  const containersQuery = useQuery({
    queryKey: containerQueryKeys.all,
    queryFn: fetchContainers,
    refetchInterval: refetchIntervalMs,
    refetchOnWindowFocus: true
  });

  const refresh = useCallback(async () => {
    await containersQuery.refetch();
  }, [containersQuery]);

  const markActionStart = useCallback((id: string, action: ContainerAction) => {
    setActionState((previous) => ({
      ...previous,
      [id]: { action, startedAt: Date.now() }
    }));
  }, []);

  const markActionEnd = useCallback((id: string) => {
    setActionState((previous) => {
      if (!(id in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);

  const runContainerAction = useCallback(
    async (target: ContainerTarget, action: ContainerAction, handler: (id: string) => Promise<unknown>) => {
      const normalized = toTarget(target);
      markActionStart(normalized.id, action);
      try {
        await handler(normalized.id);
        await queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      } finally {
        markActionEnd(normalized.id);
      }
    },
    [markActionEnd, markActionStart, queryClient]
  );

  const runBulkAction = useCallback(
    async (
      targets: ContainerTarget[],
      action: GroupAction,
      handler: (ids: string[]) => Promise<unknown>
    ) => {
      const normalized = uniqueTargets(targets);
      if (normalized.length === 0) {
        return;
      }

      setBulkState({
        action,
        startedAt: Date.now(),
        targetIds: normalized.map((target) => target.id)
      });

      try {
        await handler(normalized.map((target) => target.id));
        await queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      } finally {
        setBulkState(null);
      }
    },
    [queryClient]
  );

  const start = useCallback(
    async (target: ContainerTarget) => {
      await runContainerAction(target, "start", (id) => startContainer(id));
    },
    [runContainerAction]
  );

  const stop = useCallback(
    async (target: ContainerTarget) => {
      await runContainerAction(target, "stop", (id) => stopContainer(id));
    },
    [runContainerAction]
  );

  const restart = useCallback(
    async (target: ContainerTarget) => {
      await runContainerAction(target, "restart", (id) => restartContainer(id));
    },
    [runContainerAction]
  );

  const remove = useCallback(
    async (target: ContainerTarget) => {
      await runContainerAction(target, "delete", (id) => removeContainer(id));
    },
    [runContainerAction]
  );

  const startMany = useCallback(
    async (targets: ContainerTarget[]) => {
      await runBulkAction(targets, "start", async (ids) => {
        await Promise.all(ids.map((id) => startContainer(id)));
      });
    },
    [runBulkAction]
  );

  const stopMany = useCallback(
    async (targets: ContainerTarget[]) => {
      await runBulkAction(targets, "stop", async (ids) => {
        await Promise.all(ids.map((id) => stopContainer(id)));
      });
    },
    [runBulkAction]
  );

  const restartMany = useCallback(
    async (targets: ContainerTarget[]) => {
      await runBulkAction(targets, "restart", async (ids) => {
        await Promise.all(ids.map((id) => restartContainer(id)));
      });
    },
    [runBulkAction]
  );

  const removeMany = useCallback(
    async (targets: ContainerTarget[]) => {
      await runBulkAction(targets, "delete", async (ids) => {
        await Promise.all(ids.map((id) => removeContainer(id)));
      });
    },
    [runBulkAction]
  );

  const pruneContainers = useCallback(async () => {
    setIsPruningContainers(true);
    try {
      const summary = await pruneStoppedContainers();
      await queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      return summary;
    } finally {
      setIsPruningContainers(false);
    }
  }, [queryClient]);

  const pruneImages = useCallback(async () => {
    setIsPruningImages(true);
    try {
      const summary = await pruneUnusedImages();
      await queryClient.invalidateQueries({ queryKey: imageQueryKeys.all });
      return summary;
    } finally {
      setIsPruningImages(false);
    }
  }, [queryClient]);

  const create = useCallback(
    async (payload: CreateContainerRequest) => {
      const container = await apiCreateContainer(payload);
      await queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      return container;
    },
    [queryClient]
  );

  const value = useMemo<ContainerContextValue>(
    () => ({
      query: containersQuery,
      actions: {
        start,
        stop,
        restart,
        remove,
        startMany,
        stopMany,
        restartMany,
        removeMany,
        pruneContainers,
        pruneImages,
        create
      },
      state: {
        getContainerAction: (id: string) => actionState[id] ?? null,
        isContainerActionInFlight: (id: string) => Boolean(actionState[id]),
        bulkAction: bulkState,
        isPruningContainers,
        isPruningImages
      },
      refresh
    }),
    [
      actionState,
      bulkState,
      containersQuery,
      create,
      pruneContainers,
      pruneImages,
      refresh,
      restart,
      restartMany,
      remove,
      removeMany,
      start,
      startMany,
      stop,
      stopMany,
      isPruningContainers,
      isPruningImages
    ]
  );

  return <ContainerContext.Provider value={value}>{children}</ContainerContext.Provider>;
};

export const useContainerStore = () => {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error("useContainerStore must be used within a ContainerProvider.");
  }
  return context;
};

export const useContainerActions = () => useContainerStore().actions;
export const useContainerState = () => useContainerStore().state;

export default ContainerContext;
