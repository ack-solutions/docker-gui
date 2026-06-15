import AlertsDashboard from "./alerts-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts · Docker GUI" };

export default function AlertsPage() {
  return <AlertsDashboard />;
}
