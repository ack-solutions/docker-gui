"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchNginxSites,
  selectNginxError,
  selectNginxIsFetching,
  selectNginxSites,
  selectNginxStatus
} from "@/store/nginx/slice";

export const nginxQueryKeys = {
  sites: ["nginx", "sites"] as const
};

export const useNginxSites = () => {
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectNginxSites);
  const status = useAppSelector(selectNginxStatus);
  const error = useAppSelector(selectNginxError);
  const isFetching = useAppSelector(selectNginxIsFetching);

  useEffect(() => {
    if (status === "idle") {
      void dispatch(fetchNginxSites());
    }
  }, [dispatch, status]);

  const refetch = useCallback(() => dispatch(fetchNginxSites()).unwrap(), [dispatch]);

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
