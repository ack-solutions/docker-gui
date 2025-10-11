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
