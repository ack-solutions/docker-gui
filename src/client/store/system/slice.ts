import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchSystemMetrics as apiFetchSystemMetrics } from "@/lib/api/server";
import type { SystemMetrics } from "@/types/system";
import type { RootState } from "@/store/store";

interface SystemMetricsState {
  data: SystemMetrics | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: Error | null;
  isFetching: boolean;
  lastFetchedAt: number | null;
  history: SystemMetricsHistoryEntry[];
}

interface SystemMetricsHistoryEntry {
  timestamp: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  diskUsagePercent: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
}

const HISTORY_LIMIT = 120;

const initialState: SystemMetricsState = {
  data: null,
  status: "idle",
  error: null,
  isFetching: false,
  lastFetchedAt: null,
  history: []
};

export const fetchSystemMetrics = createAsyncThunk("system/metrics/fetch", async () => {
  return apiFetchSystemMetrics();
});

const systemMetricsSlice = createSlice({
  name: "systemMetrics",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemMetrics.pending, (state) => {
        state.isFetching = true;
        if (state.status === "idle") {
          state.status = "loading";
        }
      })
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.data = action.payload;
        state.status = "succeeded";
        state.isFetching = false;
        state.error = null;
        state.lastFetchedAt = Date.now();

        const { cpu, memory, disks, timestamp } = action.payload;
        const entry: SystemMetricsHistoryEntry = {
          timestamp,
          cpuUsagePercent: Number(cpu.overallUsagePercent.toFixed(2)),
          memoryUsagePercent: Number(memory.usagePercent.toFixed(2)),
          memoryUsedBytes: memory.usedBytes,
          memoryTotalBytes: memory.totalBytes,
          diskUsagePercent: disks ? Number(disks.usagePercent.toFixed(2)) : null,
          diskUsedBytes: disks ? disks.usedBytes : null,
          diskTotalBytes: disks ? disks.totalBytes : null
        };

        const last = state.history[state.history.length - 1];
        if (!last || last.timestamp !== entry.timestamp) {
          state.history.push(entry);
          if (state.history.length > HISTORY_LIMIT) {
            state.history.splice(0, state.history.length - HISTORY_LIMIT);
          }
        } else {
          state.history[state.history.length - 1] = entry;
        }
      })
      .addCase(fetchSystemMetrics.rejected, (state, action) => {
        state.isFetching = false;
        if (state.status === "idle") {
          state.status = "failed";
        }
        state.error = new Error(action.error.message ?? "Unable to collect system metrics");
      });
  }
});

export const selectSystemMetrics = (state: RootState) => state.system.metrics.data;
export const selectSystemMetricsStatus = (state: RootState) => state.system.metrics.status;
export const selectSystemMetricsIsFetching = (state: RootState) => state.system.metrics.isFetching;
export const selectSystemMetricsError = (state: RootState) => state.system.metrics.error;
export const selectSystemMetricsHistory = (state: RootState) => state.system.metrics.history;

export default systemMetricsSlice.reducer;
