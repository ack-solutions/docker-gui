"use client";

import { ContainerProvider } from "@/features/docker/containers/context/container-provider";
import ContainerList from "@/features/docker/containers/components/container-list";

const DockerContainersPage = () => {
  return (
    <ContainerProvider>
      <ContainerList />
    </ContainerProvider>
  );
};

export default DockerContainersPage;
