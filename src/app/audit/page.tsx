import AuditDashboard from "./audit-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log · Docker GUI" };

export default function AuditPage() {
  return <AuditDashboard />;
}
