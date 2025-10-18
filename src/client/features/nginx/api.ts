import apiClient from "@/lib/api/client";
import type { NginxSite, NginxProvisionLog } from "@/types/server";
import type { NginxSitePayload } from "@/features/nginx/utils/form";

export const createNginxSite = async (payload: NginxSitePayload) => {
  const { data } = await apiClient.post<NginxSite>("/nginx/sites", payload);
  return data;
};

export const updateNginxSite = async (id: string, payload: NginxSitePayload) => {
  const { data } = await apiClient.put<NginxSite>(`/nginx/sites/${id}`, payload);
  return data;
};

export const deleteNginxSite = async (id: string) => {
  await apiClient.delete(`/nginx/sites/${id}`);
};

export const deployNginxSite = async (id: string) => {
  const { data } = await apiClient.post<NginxSite>(`/nginx/sites/${id}/deploy`);
  return data;
};

export const fetchNginxProvisionLogs = async (id: string, limit = 50) => {
  const { data } = await apiClient.get<NginxProvisionLog[]>(
    `/nginx/sites/${id}/logs?limit=${limit}`
  );
  return data;
};
