"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchNginxSites } from "@/lib/api/server";
import type { NginxSite } from "@/types/server";

export const nginxQueryKeys = {
  sites: ["nginx", "sites"] as const
};

export const useNginxSites = () =>
  useQuery<NginxSite[]>({
    queryKey: nginxQueryKeys.sites,
    queryFn: fetchNginxSites
  });
