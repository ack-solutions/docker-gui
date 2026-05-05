import DnsDashboard from "./dns-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "DNS · Docker GUI" };

export default function DnsPage() {
  return <DnsDashboard />;
}
