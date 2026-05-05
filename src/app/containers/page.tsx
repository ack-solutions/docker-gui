import ContainersDashboard from "./containers-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Containers · Docker GUI"
};

export default function ContainersPage() {
  return <ContainersDashboard />;
}
