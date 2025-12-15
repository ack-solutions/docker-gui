import apiClient from "@/lib/api/client";
import type { Domain, DomainUpsertInput } from "@/types/server";

export const fetchDomain = async (id: string): Promise<Domain> => {
  const { data } = await apiClient.get<Domain>(`/domains/${id}`);
  return data;
};

export const createDomain = async (payload: DomainUpsertInput) => {
  const { data } = await apiClient.post<Domain>("/domains", payload);
  return data;
};

export const updateDomain = async (id: string, payload: DomainUpsertInput) => {
  const { data } = await apiClient.put<Domain>(`/domains/${id}`, payload);
  return data;
};

export const deleteDomain = async (id: string) => {
  await apiClient.delete(`/domains/${id}`);
};
