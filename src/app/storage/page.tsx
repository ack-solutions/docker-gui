import StorageDashboard from "./storage-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Storage · Docker GUI" };

export default function StoragePage() {
  return <StorageDashboard />;
}
