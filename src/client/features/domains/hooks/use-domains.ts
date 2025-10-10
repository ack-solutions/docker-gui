"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDomains } from "@/lib/api/server";
import type { ServerDomain } from "@/types/server";

export const domainQueryKeys = {
  all: ["domains"] as const
};

export const useDomains = () =>
  useQuery<ServerDomain[]>({
    queryKey: domainQueryKeys.all,
    queryFn: fetchDomains
  });
