import HealthDashboard from "./health-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Health · Docker GUI",
  description: "Live system health and metrics for the docker-gui server."
};

export default function HealthPage() {
  return <HealthDashboard />;
}
