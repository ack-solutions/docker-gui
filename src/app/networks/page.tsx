import NetworksDashboard from "./networks-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Networks · Docker GUI" };

export default function NetworksPage() {
  return <NetworksDashboard />;
}
