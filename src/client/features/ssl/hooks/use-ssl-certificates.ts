"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCertificates } from "@/lib/api/server";
import type { SSLCertificate } from "@/types/server";

export const sslQueryKeys = {
  certificates: ["ssl", "certificates"] as const
};

export const useSslCertificates = () =>
  useQuery<SSLCertificate[]>({
    queryKey: sslQueryKeys.certificates,
    queryFn: fetchCertificates
  });
