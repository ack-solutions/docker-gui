"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/v2/auth-client";
import { LoadingState } from "@/components";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isAuthenticated() ? "/containers" : "/login");
  }, [router]);
  return <LoadingState message="Redirecting…" />;
}
