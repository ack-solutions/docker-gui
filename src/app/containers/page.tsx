"use client";

import { useCallback, useEffect } from "react";
import ContainerList from "@/features/docker/containers/components/container-list";
import { ContainerProvider, useContainerStore } from "@/features/docker/containers/context/container-provider";
import { useHeaderActions } from "@/components/layout/header-actions-context";

const ContainersPageContent = () => {
  const { refresh } = useContainerStore();
  const { setActions, clearActions } = useHeaderActions();

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setActions({ onRefresh: handleRefresh });
    return () => {
      clearActions();
    };
  }, [clearActions, handleRefresh, setActions]);

  return <ContainerList />;
};

const ContainersPage = () => {
  return (
    <ContainerProvider>
      <ContainersPageContent />
    </ContainerProvider>
  );
};

export default ContainersPage;
