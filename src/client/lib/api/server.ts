import apiClient from "@/lib/api/client";
import type {
  ServerDomain,
  SSLCertificate,
  NginxSite,
  ProxyRoute,
  EmailAccount,
  EmailServiceInfo
} from "@/types/server";
import type { SystemMetrics } from "@/types/system";
import type { CreateUserInput, UpdateUserInput, User } from "@/types/user";

export const fetchDomains = async () => {
  const { data } = await apiClient.get<ServerDomain[]>("/domains");
  return data;
};

export const fetchCertificates = async () => {
  const { data } = await apiClient.get<SSLCertificate[]>("/ssl/certificates");
  return data;
};

export const fetchNginxSites = async () => {
  const { data } = await apiClient.get<NginxSite[]>("/nginx/sites");
  return data;
};

export const fetchProxyRoutes = async () => {
  const { data } = await apiClient.get<ProxyRoute[]>("/proxies/routes");
  return data;
};

export const fetchEmailAccounts = async () => {
  const { data } = await apiClient.get<EmailAccount[]>("/email/accounts");
  return data;
};

export const fetchEmailServiceInfo = async () => {
  const { data } = await apiClient.get<EmailServiceInfo>("/email/info");
  return data;
};

export const fetchSystemMetrics = async () => {
  const { data } = await apiClient.get<SystemMetrics>("/system/metrics");
  return data;
};

export interface CpuMetricsLog {
  id: string;
  timestamp: Date;
  usagePercent: number;
  loadAverage1m: number;
  loadAverage5m: number;
  loadAverage15m: number;
  coresUsage: { coreId: string; usagePercent: number }[];
  createdAt: Date;
}

export interface MemoryMetricsLog {
  id: string;
  timestamp: Date;
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  createdAt: Date;
}

export interface DiskMetricsLog {
  id: string;
  timestamp: Date;
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
  partitions: { filesystem: string; mountpoint: string; usagePercent: number; usedBytes: number; totalBytes: number }[];
  createdAt: Date;
}

export interface MetricsLogsResponse {
  cpu: { logs: CpuMetricsLog[]; count: number };
  memory: { logs: MemoryMetricsLog[]; count: number };
  disk: { logs: DiskMetricsLog[]; count: number };
}

export interface SingleMetricsLogsResponse<T> {
  logs: T[];
  count: number;
  type: "cpu" | "memory" | "disk";
}

export interface FetchMetricsLogsParams {
  type?: "cpu" | "memory" | "disk";
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export const fetchMetricsLogs = async (params?: FetchMetricsLogsParams) => {
  const queryParams = new URLSearchParams();
  
  if (params?.type) queryParams.set("type", params.type);
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.offset) queryParams.set("offset", String(params.offset));
  if (params?.startDate) queryParams.set("startDate", params.startDate);
  if (params?.endDate) queryParams.set("endDate", params.endDate);

  const { data } = await apiClient.get<any>(
    `/system/metrics/logs?${queryParams.toString()}`
  );
  return data;
};

export interface Setting {
  key: string;
  value: string;
  valueType: "string" | "number" | "boolean" | "json";
  description?: string | null;
  updatedAt: Date;
}

export const fetchSettings = async () => {
  const { data } = await apiClient.get<{ settings: Setting[] }>("/system/settings");
  return data.settings;
};

export const fetchSetting = async (key: string) => {
  const { data } = await apiClient.get<Setting>(`/system/settings?key=${key}`);
  return data;
};

export const saveSetting = async (key: string, value: any, description?: string) => {
  const { data } = await apiClient.post<Setting>("/system/settings", { key, value, description });
  return data;
};

export const deleteSetting = async (key: string) => {
  await apiClient.delete(`/system/settings?key=${key}`);
};

export const cleanupMetricsLogs = async (type?: "cpu" | "memory" | "disk") => {
  const { data } = await apiClient.post<{ 
    success: boolean; 
    deletedCount: number; 
    details: { cpu: number; memory: number; disk: number };
    message: string 
  }>("/system/metrics/cleanup", { type });
  return data;
};

export const fetchUsers = async () => {
  const { data } = await apiClient.get<User[]>("/users");
  return data;
};

export const createUser = async (payload: CreateUserInput) => {
  const { data } = await apiClient.post<User>("/users", payload);
  return data;
};

export const updateUser = async (id: string, payload: UpdateUserInput) => {
  const { data } = await apiClient.patch<User>(`/users/${id}`, payload);
  return data;
};

export const deleteUser = async (id: string) => {
  await apiClient.delete(`/users/${id}`);
};
