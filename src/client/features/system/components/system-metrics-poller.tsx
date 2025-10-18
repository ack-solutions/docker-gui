"use client";

import { useEffect } from "react";
import { fetchSystemMetrics } from "@/store/system/slice";
import { useAppDispatch } from "@/store/hooks";

const DEFAULT_INTERVAL_MS = 10000;
const VISIBILITY_BACKOFF_MS = 30000;
const MAX_INTERVAL_MS = 60000;

interface SystemMetricsPollerProps {
  intervalMs?: number;
  maxIntervalMs?: number;
}

/**
 * Keeps system metrics fresh in the Redux store by polling on a fixed cadence with basic backoff.
 * The poller slows down when the tab is hidden and accelerates again when the user returns.
 */
const SystemMetricsPoller = ({ intervalMs = DEFAULT_INTERVAL_MS, maxIntervalMs = MAX_INTERVAL_MS }: SystemMetricsPollerProps) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let timeoutId: number | null = null;
    let cancelled = false;
    let inFlight = false;
    let nextDelay = intervalMs;

    const effectiveMaxInterval = Math.max(maxIntervalMs, intervalMs);

    const schedule = (delay: number) => {
      if (cancelled) {
        return;
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;

      try {
        await dispatch(fetchSystemMetrics()).unwrap();
        nextDelay = intervalMs;
      } catch (error) {
        const fallback = Math.max(nextDelay * 1.75, intervalMs * 1.5);
        nextDelay = Math.min(fallback, effectiveMaxInterval);
      } finally {
        inFlight = false;

        if (!cancelled) {
          schedule(nextDelay);
        }
      }
    };

    void poll();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const hiddenDelay = Math.min(
          Math.max(intervalMs * 2, VISIBILITY_BACKOFF_MS),
          effectiveMaxInterval
        );
        nextDelay = hiddenDelay;
        schedule(hiddenDelay);
      } else {
        nextDelay = intervalMs;
        if (!inFlight) {
          void poll();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dispatch, intervalMs, maxIntervalMs]);

  return null;
};

export default SystemMetricsPoller;
