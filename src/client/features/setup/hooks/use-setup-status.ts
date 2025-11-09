import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import type { SetupStatus } from "@/types/setup";

const fetchSetupStatus = async (): Promise<SetupStatus> => {
  const { data } = await apiClient.get<SetupStatus>("/setup/status", {
    headers: { "x-skip-auth-redirect": "true" }
  });
  return data;
};

export const useSetupStatus = () =>
  useQuery({
    queryKey: ["setup-status"],
    queryFn: fetchSetupStatus,
    staleTime: 60_000
  });
