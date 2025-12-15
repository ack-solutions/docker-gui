"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDomains } from "@/lib/api/server";
import { fetchDomain } from "../api";
import type { Domain } from "@/types/server";

export const domainQueryKeys = {
  all: ["domains"] as const,
  detail: (id: string) => ["domains", id] as const,
};

export const useDomains = () =>
  useQuery<Domain[]>({
    queryKey: domainQueryKeys.all,
    queryFn: fetchDomains
  });

export const useDomain = (id: string | undefined) => {
  return useQuery<Domain>({
    queryKey: domainQueryKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) {
        return Promise.reject(new Error("Domain id is required"));
      }
      return fetchDomain(id);
    },
    enabled: Boolean(id),
  });
};
