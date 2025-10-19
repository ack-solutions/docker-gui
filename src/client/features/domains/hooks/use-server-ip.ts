import { useQuery } from "@tanstack/react-query";

interface ServerIpResponse {
  publicIp: string;
  localIp: string;
  hasPublicIp: boolean;
  error?: string;
}

export function useServerIp() {
  return useQuery({
    queryKey: ["server-ip"],
    queryFn: async (): Promise<ServerIpResponse> => {
      const response = await fetch("/api/system/server-ip");
      if (!response.ok) {
        throw new Error("Failed to fetch server IP");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

