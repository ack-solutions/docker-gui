import DatabasesDashboard from "./databases-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Databases · Docker GUI" };

export default function DatabasesPage() {
  return <DatabasesDashboard />;
}
