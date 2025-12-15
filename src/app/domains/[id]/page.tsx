"use client";

import { useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { Paper, Stack, Typography } from "@mui/material";
import { useDomain, useDomains } from "@/features/domains/hooks/use-domains";
import { useHeaderActions } from "@/components/layout/header-actions-context";
import DomainDetailContent from "@/features/domains/components/domain-detail-content";
import { useState } from "react";

const DomainDetailPageContent = ({ domainId }: { domainId: string }) => {
  const domainQuery = useDomain(domainId);
  const { data: allDomains } = useDomains();
  const { setActions, clearActions } = useHeaderActions();
  const [activeTab, setActiveTab] = useState(0);

  const handleRefresh = useCallback(async () => {
    await domainQuery.refetch();
  }, [domainQuery]);

  useEffect(() => {
    setActions({ onRefresh: handleRefresh });
    return () => {
      clearActions();
    };
  }, [setActions, clearActions, handleRefresh]);

  if (domainQuery.isLoading) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6">Loading domain...</Typography>
      </Paper>
    );
  }

  if (domainQuery.isError || !domainQuery.data) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Domain not found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The domain you're looking for doesn't exist or has been deleted.
        </Typography>
      </Paper>
    );
  }

  return (
    <DomainDetailContent
      domain={domainQuery.data}
      allDomains={allDomains ?? []}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
};

const DomainDetailPage = () => {
  const params = useParams<{ id: string }>();
  const domainId = params?.id;

  if (!domainId) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Domain not specified
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Provide a domain id in the URL to view details.
        </Typography>
      </Paper>
    );
  }

  return <DomainDetailPageContent domainId={domainId} />;
};

export default DomainDetailPage;

