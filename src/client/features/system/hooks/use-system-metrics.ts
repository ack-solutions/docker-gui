"use client";

import { useCallback, useMemo } from "react";
import {
  fetchSystemMetrics,
  selectSystemMetrics,
  selectSystemMetricsError,
  selectSystemMetricsHistory,
  selectSystemMetricsIsFetching,
  selectSystemMetricsLastFetchedAt,
  selectSystemMetricsStatus
} from "@/store/system/slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export const useSystemMetrics = () => {
  const dispatch = useAppDispatch();
  const metrics = useAppSelector(selectSystemMetrics);
  const status = useAppSelector(selectSystemMetricsStatus);
  const isFetching = useAppSelector(selectSystemMetricsIsFetching);
  const error = useAppSelector(selectSystemMetricsError);
  const history = useAppSelector(selectSystemMetricsHistory);
  const lastFetchedAt = useAppSelector(selectSystemMetricsLastFetchedAt);

  const refetch = useCallback(() => dispatch(fetchSystemMetrics()).unwrap(), [dispatch]);

  return useMemo(
    () => ({
      metrics,
      status,
      isFetching,
      error,
      history,
      lastFetchedAt,
      refetch
    }),
    [metrics, status, isFetching, error, history, lastFetchedAt, refetch]
  );
};

export type UseSystemMetricsReturn = ReturnType<typeof useSystemMetrics>;
