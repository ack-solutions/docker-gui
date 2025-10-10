import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import {
  createContainer as apiCreateContainer,
  fetchContainers as apiFetchContainers,
  pruneStoppedContainers,
  pruneUnusedImages,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer
} from "@/lib/api/docker";
import type {
  CreateContainerRequest,
  DockerContainer,
  DockerPruneSummary
} from "@/types/docker";
import type { RootState } from "@/store/store";

type ContainerAction = "start" | "stop" | "restart" | "delete";
type GroupAction = "start" | "stop" | "restart" | "delete";

export interface ContainerActionState {
  action: ContainerAction;
  startedAt: number;
}

export interface ContainerBulkActionState {
  action: GroupAction;
  startedAt: number;
  targetIds: string[];
}

export type ContainerTarget = Pick<DockerContainer, "id" | "name">;

interface ContainersState {
  items: DockerContainer[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: Error | null;
  isFetching: boolean;
  lastFetchedAt: number | null;
  actionState: Record<string, ContainerActionState>;
  bulkAction: ContainerBulkActionState | null;
  isPruningContainers: boolean;
  isPruningImages: boolean;
}

const initialState: ContainersState = {
  items: [],
  status: "idle",
  error: null,
  isFetching: false,
  lastFetchedAt: null,
  actionState: {},
  bulkAction: null,
  isPruningContainers: false,
  isPruningImages: false
};

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

export const fetchContainers = createAsyncThunk(
  "docker/containers/fetchAll",
  async () => {
    return apiFetchContainers();
  }
);

export const createContainer = createAsyncThunk(
  "docker/containers/create",
  async (payload: CreateContainerRequest, { dispatch }) => {
    const container = await apiCreateContainer(payload);
    await dispatch(fetchContainers());
    return container;
  }
);

const makeSingleActionThunk = (
  type: ContainerAction,
  handler: (id: string) => Promise<unknown>
) =>
  createAsyncThunk(
    `docker/containers/${type}`,
    async (target: ContainerTarget, { dispatch }) => {
      const normalized = toTarget(target);
      await handler(normalized.id);
      await dispatch(fetchContainers());
      return normalized;
    }
  );

export const startContainerAction = makeSingleActionThunk("start", startContainer);
export const stopContainerAction = makeSingleActionThunk("stop", stopContainer);
export const restartContainerAction = makeSingleActionThunk("restart", restartContainer);
export const removeContainerAction = makeSingleActionThunk("delete", removeContainer);

const makeBulkActionThunk = (
  type: GroupAction,
  handler: (ids: string[]) => Promise<unknown>
) =>
  createAsyncThunk(
    `docker/containers/bulk-${type}`,
    async (targets: ContainerTarget[], { dispatch }) => {
      const normalized = uniqueTargets(targets);
      if (normalized.length === 0) {
        return { ids: [] };
      }
      await handler(normalized.map((target) => target.id));
      await dispatch(fetchContainers());
      return {
        ids: normalized.map((target) => target.id)
      };
    }
  );

const runBulk =
  (runner: (id: string) => Promise<unknown>) =>
  async (ids: string[]) => {
    await Promise.all(ids.map((id) => runner(id)));
  };

export const startManyContainersAction = makeBulkActionThunk("start", runBulk(startContainer));
export const stopManyContainersAction = makeBulkActionThunk("stop", runBulk(stopContainer));
export const restartManyContainersAction = makeBulkActionThunk("restart", runBulk(restartContainer));
export const removeManyContainersAction = makeBulkActionThunk("delete", runBulk(removeContainer));

export const pruneContainers = createAsyncThunk(
  "docker/containers/prune",
  async (_arg, { dispatch }) => {
    const summary = await pruneStoppedContainers();
    await dispatch(fetchContainers());
    return summary;
  }
);

export const pruneImages = createAsyncThunk(
  "docker/images/prune",
  async (_arg, { dispatch }) => {
    const summary = await pruneUnusedImages();
    await dispatch(fetchContainers());
    return summary;
  }
);

const containersSlice = createSlice({
  name: "docker/containers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContainers.pending, (state) => {
        state.isFetching = true;
        if (state.status === "idle") {
          state.status = "loading";
        }
      })
      .addCase(fetchContainers.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.isFetching = false;
        state.error = null;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchContainers.rejected, (state, action) => {
        state.isFetching = false;
        if (state.status === "idle") {
          state.status = "failed";
        }
        state.error = new Error(action.error.message ?? "Unable to fetch containers");
      });

    builder
      .addCase(pruneContainers.pending, (state) => {
        state.isPruningContainers = true;
      })
      .addCase(pruneContainers.fulfilled, (state) => {
        state.isPruningContainers = false;
      })
      .addCase(pruneContainers.rejected, (state) => {
        state.isPruningContainers = false;
      });

    builder
      .addCase(pruneImages.pending, (state) => {
        state.isPruningImages = true;
      })
      .addCase(pruneImages.fulfilled, (state) => {
        state.isPruningImages = false;
      })
      .addCase(pruneImages.rejected, (state) => {
        state.isPruningImages = false;
      });

    builder.addMatcher(
      isAnyOf(
        startContainerAction.pending,
        stopContainerAction.pending,
        restartContainerAction.pending,
        removeContainerAction.pending
      ),
      (state, action) => {
        const payload = action.meta.arg;
        const actionType = action.type.includes("/start")
          ? "start"
          : action.type.includes("/stop")
            ? "stop"
            : action.type.includes("/restart")
              ? "restart"
              : "delete";
        state.actionState[payload.id] = {
          action: actionType,
          startedAt: Date.now()
        };
      }
    );

    builder.addMatcher(
      isAnyOf(
        startContainerAction.fulfilled,
        stopContainerAction.fulfilled,
        restartContainerAction.fulfilled,
        removeContainerAction.fulfilled,
        startContainerAction.rejected,
        stopContainerAction.rejected,
        restartContainerAction.rejected,
        removeContainerAction.rejected
      ),
      (state, action) => {
        const payload = action.meta.arg;
        delete state.actionState[payload.id];
      }
    );

    builder.addMatcher(
      isAnyOf(
        startManyContainersAction.pending,
        stopManyContainersAction.pending,
        restartManyContainersAction.pending,
        removeManyContainersAction.pending
      ),
      (state, action) => {
        const payload = action.meta.arg;
        const ids = uniqueTargets(payload).map((target) => target.id);
        if (!ids.length) {
          return;
        }

        const actionType = action.type.includes("bulk-start")
          ? "start"
          : action.type.includes("bulk-stop")
            ? "stop"
            : action.type.includes("bulk-restart")
              ? "restart"
              : "delete";

        state.bulkAction = {
          action: actionType,
          targetIds: ids,
          startedAt: Date.now()
        };
      }
    );

    builder.addMatcher(
      isAnyOf(
        startManyContainersAction.fulfilled,
        stopManyContainersAction.fulfilled,
        restartManyContainersAction.fulfilled,
        removeManyContainersAction.fulfilled,
        startManyContainersAction.rejected,
        stopManyContainersAction.rejected,
        restartManyContainersAction.rejected,
        removeManyContainersAction.rejected
      ),
      (state) => {
        state.bulkAction = null;
      }
    );
  }
});

export const selectContainers = (state: RootState) => state.docker.containers.items;
export const selectContainersStatus = (state: RootState) => state.docker.containers.status;
export const selectContainersError = (state: RootState) => state.docker.containers.error;
export const selectContainersIsFetching = (state: RootState) => state.docker.containers.isFetching;
export const selectContainerActionState = (state: RootState) => state.docker.containers.actionState;
export const selectContainerBulkAction = (state: RootState) => state.docker.containers.bulkAction;
export const selectContainerPruneState = (state: RootState) => ({
  isPruningContainers: state.docker.containers.isPruningContainers,
  isPruningImages: state.docker.containers.isPruningImages
});

export default containersSlice.reducer;
