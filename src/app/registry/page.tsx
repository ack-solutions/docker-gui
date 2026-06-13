import RegistryDashboard from "./registry-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registry · Docker GUI" };

export default function RegistryPage() {
  return <RegistryDashboard />;
}
