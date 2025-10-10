import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { fetchNginxSites as apiFetchNginxSites } from "@/lib/api/server";
import {
  createDefaultForm,
  toFormState,
  type NginxFormState
} from "@/features/nginx/utils/form";
import type { NginxSite } from "@/types/server";
import type { RootState } from "@/store/store";

interface NginxState {
  sites: NginxSite[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: Error | null;
  selectedId: string | null;
  form: NginxFormState;
  lastFetchedAt: number | null;
  isFetching: boolean;
}

const initialState: NginxState = {
  sites: [],
  status: "idle",
  error: null,
  selectedId: null,
  form: createDefaultForm(),
  lastFetchedAt: null,
  isFetching: false
};

export const fetchNginxSites = createAsyncThunk("nginx/fetchSites", async () => {
  return apiFetchNginxSites();
});

const nginxSlice = createSlice({
  name: "nginx",
  initialState,
  reducers: {
    setSelectedSite(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
      if (action.payload) {
        const site = state.sites.find((item) => item.id === action.payload);
        state.form = site ? toFormState(site) : createDefaultForm();
      } else {
        state.form = createDefaultForm();
      }
    },
    updateForm(state, action: PayloadAction<Partial<NginxFormState>>) {
      state.form = {
        ...state.form,
        ...action.payload
      };
    },
    setForm(state, action: PayloadAction<NginxFormState>) {
      state.form = action.payload;
    },
    resetForm(state) {
      state.selectedId = null;
      state.form = createDefaultForm();
    },
    toggleSiteEnabled(state, action: PayloadAction<string>) {
      const site = state.sites.find((item) => item.id === action.payload);
      if (!site) {
        return;
      }
      site.enabled = !site.enabled;
      site.lastDeployedAt = new Date().toISOString();
    },
    upsertSite(state, action: PayloadAction<NginxSite>) {
      const incoming = action.payload;
      const index = state.sites.findIndex((site) => site.id === incoming.id);
      if (index >= 0) {
        state.sites[index] = { ...state.sites[index], ...incoming };
      } else {
        state.sites.push(incoming);
      }
      state.selectedId = incoming.id;
      state.form = toFormState(incoming);
    },
    deleteSite(state, action: PayloadAction<string>) {
      state.sites = state.sites.filter((site) => site.id !== action.payload);
      if (state.selectedId === action.payload) {
        state.selectedId = null;
        state.form = createDefaultForm();
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNginxSites.pending, (state) => {
        state.isFetching = true;
        state.status = state.status === "idle" ? "loading" : state.status;
        state.error = null;
      })
      .addCase(fetchNginxSites.fulfilled, (state, action) => {
        state.sites = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.lastFetchedAt = Date.now();
        state.isFetching = false;

        if (state.selectedId) {
          const selected = action.payload.find((site) => site.id === state.selectedId);
          state.form = selected ? toFormState(selected) : createDefaultForm();
          if (!selected) {
            state.selectedId = null;
          }
        } else if (action.payload.length) {
          const first = action.payload[0];
          state.selectedId = first.id;
          state.form = toFormState(first);
        } else {
          state.form = createDefaultForm();
        }
      })
      .addCase(fetchNginxSites.rejected, (state, action) => {
        state.status = "failed";
        state.isFetching = false;
        state.error = new Error(action.error.message ?? "Unable to load Nginx sites");
      });
  }
});

export const {
  setSelectedSite,
  updateForm,
  setForm,
  resetForm,
  toggleSiteEnabled,
  upsertSite,
  deleteSite
} = nginxSlice.actions;

export const selectNginxSites = (state: RootState) => state.nginx.sites;
export const selectNginxStatus = (state: RootState) => state.nginx.status;
export const selectNginxError = (state: RootState) => state.nginx.error;
export const selectNginxSelectedId = (state: RootState) => state.nginx.selectedId;
export const selectNginxForm = (state: RootState) => state.nginx.form;
export const selectNginxIsFetching = (state: RootState) => state.nginx.isFetching;

export default nginxSlice.reducer;
