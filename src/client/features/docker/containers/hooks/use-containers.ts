"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createContainer,
  fetchContainers,
  pruneContainers as pruneContainersThunk,
  pruneImages as pruneImagesThunk,
  restartContainerAction,
  restartManyContainersAction,
  removeContainerAction,
  removeManyContainersAction,
  selectContainerActionState,
  selectContainerBulkAction,
  selectContainerPruneState,
  selectContainers,
  selectContainersError,
  selectContainersIsFetching,
  selectContainersStatus,
  startContainerAction,
  startManyContainersAction,
  stopContainerAction,
  stopManyContainersAction,
  type ContainerTarget,
  type ContainerActionState,
  type ContainerBulkActionState
} from "@/store/docker/slice";
import type { CreateContainerRequest, DockerContainer } from "@/types/docker";

export interface UseContainersOptions {
  refetchIntervalMs?: number;
  refetchOnWindowFocus?: boolean;
}

interface ContainersQuery {
  data: DockerContainer[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<DockerContainer[]>;
}

export const useContainers = ({
  refetchIntervalMs,
  refetchOnWindowFocus = true
}: UseContainersOptions = {}): ContainersQuery => {
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectContainers);
  const status = useAppSelector(selectContainersStatus);
  const error = useAppSelector(selectContainersError);
  const isFetching = useAppSelector(selectContainersIsFetching);

  useEffect(() => {
    if (!refetchIntervalMs || refetchIntervalMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void dispatch(fetchContainers());
    }, refetchIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dispatch, refetchIntervalMs]);

  useEffect(() => {
    if (!refetchOnWindowFocus) {
      return;
    }

    const handleFocus = () => {
      void dispatch(fetchContainers());
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [dispatch, refetchOnWindowFocus]);

  const refetch = useCallback(() => dispatch(fetchContainers()).unwrap(), [dispatch]);

  return useMemo(
    () => ({
      data,
      isLoading: status === "idle" || (status === "loading" && data.length === 0),
      isFetching,
      isError: status === "failed",
      error,
      refetch
    }),
    [data, status, isFetching, error, refetch]
  );
};

export const useContainerActions = () => {
  const dispatch = useAppDispatch();

  return useMemo(
    () => ({
      start: (target: ContainerTarget) => dispatch(startContainerAction(target)).unwrap(),
      stop: (target: ContainerTarget) => dispatch(stopContainerAction(target)).unwrap(),
      restart: (target: ContainerTarget) => dispatch(restartContainerAction(target)).unwrap(),
      remove: (target: ContainerTarget) => dispatch(removeContainerAction(target)).unwrap(),
      startMany: (targets: ContainerTarget[]) => dispatch(startManyContainersAction(targets)).unwrap(),
      stopMany: (targets: ContainerTarget[]) => dispatch(stopManyContainersAction(targets)).unwrap(),
      restartMany: (targets: ContainerTarget[]) => dispatch(restartManyContainersAction(targets)).unwrap(),
      removeMany: (targets: ContainerTarget[]) => dispatch(removeManyContainersAction(targets)).unwrap(),
      pruneContainers: () => dispatch(pruneContainersThunk()).unwrap(),
      pruneImages: () => dispatch(pruneImagesThunk()).unwrap(),
      create: (payload: CreateContainerRequest) => dispatch(createContainer(payload)).unwrap()
    }),
    [dispatch]
  );
};

export const useContainerState = () => {
  const actionStateMap = useAppSelector(selectContainerActionState);
  const bulkAction = useAppSelector(selectContainerBulkAction);
  const pruneState = useAppSelector(selectContainerPruneState);

  return useMemo(
    () => ({
      getContainerAction: (id: string): ContainerActionState | null => actionStateMap[id] ?? null,
      isContainerActionInFlight: (id: string) => Boolean(actionStateMap[id]),
      bulkAction: bulkAction as ContainerBulkActionState | null,
      isPruningContainers: pruneState.isPruningContainers,
      isPruningImages: pruneState.isPruningImages
    }),
    [actionStateMap, bulkAction, pruneState]
  );
};

export const useContainerMetrics = (options?: UseContainersOptions) => {
  const { data, ...rest } = useContainers(options);

  const metrics = useMemo(() => {
    if (!data) {
      return {
        running: 0,
        stopped: 0,
        totalCpu: 0,
        totalMemory: 0
      };
    }

    const running = data.filter((container) => container.state === "running").length;
    const stopped = data.length - running;
    const totalCpu = data.reduce((sum, container) => sum + container.cpuUsage, 0);
    const totalMemory = data.reduce((sum, container) => sum + container.memoryUsage, 0);

    return { running, stopped, totalCpu, totalMemory };
  }, [data]);

  return { data, metrics, ...rest };
};
