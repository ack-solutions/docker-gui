"use client";

import { useCallback, useEffect } from "react";
import ContainerList from "@/features/docker/containers/components/container-list";
import { useHeaderActions } from "@/components/layout/header-actions-context";
import { useAppDispatch } from "@/store/hooks";
import { fetchContainers } from "@/store/docker/slice";

const ContainersPage = () => {
  const dispatch = useAppDispatch();
  const { setActions, clearActions } = useHeaderActions();

  const handleRefresh = useCallback(() => {
    void dispatch(fetchContainers());
  }, [dispatch]);

  useEffect(() => {
    setActions({ onRefresh: handleRefresh });
    return () => {
      clearActions();
    };
  }, [clearActions, handleRefresh, setActions]);

  return <ContainerList />;
};

export default ContainersPage;
