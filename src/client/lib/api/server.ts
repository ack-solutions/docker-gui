import apiClient from "@/lib/api/client";
import {
  mockDomains,
  mockCertificates,
  mockNginxSites,
  mockProxyRoutes,
  mockEmailAccounts,
  mockEmailService
} from "@/lib/mocks/server";
import type {
  ServerDomain,
  SSLCertificate,
  NginxSite,
  ProxyRoute,
  EmailAccount,
  EmailServiceInfo
} from "@/types/server";
import type { CreateUserInput, UpdateUserInput, User } from "@/types/user";

const useMockData = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const withMockFallback = async <T>(factory: () => Promise<T>, mock: () => T): Promise<T> => {
  if (useMockData) {
    return mock();
  }
  return factory();
};

export const fetchDomains = () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<ServerDomain[]>("/server/domains");
      return data;
    },
    () => mockDomains
  );

export const fetchCertificates = () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<SSLCertificate[]>("/server/ssl/certificates");
      return data;
    },
    () => mockCertificates
  );

export const fetchNginxSites = () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<NginxSite[]>("/server/nginx/sites");
      return data;
    },
    () => mockNginxSites
  );

export const fetchProxyRoutes = () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<ProxyRoute[]>("/server/proxies/routes");
      return data;
    },
    () => mockProxyRoutes
  );

export const fetchEmailAccounts = () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<EmailAccount[]>("/server/email/accounts");
      return data;
    },
    () => mockEmailAccounts
  );

export const fetchEmailServiceInfo = () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<EmailServiceInfo>("/server/email/info");
      return data;
    },
    () => mockEmailService
  );

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
