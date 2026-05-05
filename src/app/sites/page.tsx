import SitesDashboard from "./sites-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites · Docker GUI" };

export default function SitesPage() {
  return <SitesDashboard />;
}
